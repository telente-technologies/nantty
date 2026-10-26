package restoreacceptedtakedowns

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/events"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/copyrightclaim"
	"nantty/modules/moderation/src/generated/ent/counternotice"
	contentservices "nantty/modules/moderation/src/modules/contentReports/services"
	claimevents "nantty/modules/moderation/src/modules/copyrightClaims/events"
	strikeservices "nantty/modules/moderation/src/modules/strikes/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context) (int, error) {
	now := handler.Container.Now()
	due, err := handler.Container.Client.CounterNotice.Query().Where(
		counternotice.StatusEQ(counternotice.StatusAccepted), counternotice.CourtActionRecorded(false), counternotice.RestoredAtIsNil(), counternotice.RestoreEligibleAtLTE(now),
	).Limit(100).All(ctx)
	if err != nil {
		return 0, err
	}
	restored := 0
	for _, notice := range due {
		if err := handler.restoreOne(ctx, notice, now); err != nil {
			return restored, err
		}
		restored++
	}
	return restored, nil
}

func (handler Handler) restoreOne(ctx context.Context, notice *ent.CounterNotice, now any) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		claim, err := tx.CopyrightClaim.Get(ctx, notice.ClaimID)
		if err != nil {
			return err
		}
		if claim.Status == copyrightclaim.StatusRestored {
			return tx.CounterNotice.UpdateOne(notice).SetRestoredAt(handler.Container.Now()).Exec(ctx)
		}
		moment := handler.Container.Now()
		infringer := ""
		if claim.InfringerID != nil {
			infringer = claim.InfringerID.String()
		}
		recorder := strikeservices.Recorder{Now: handler.Container.Now}
		for _, strikeId := range []*uuid.UUID{claim.StrikeID, claim.WarningID} {
			if strikeId == nil {
				continue
			}
			if _, err := recorder.Revoke(ctx, tx, *strikeId, "Counter-notice accepted and the restoration period passed"); err != nil {
				return err
			}
		}
		if err := tx.CopyrightClaim.UpdateOne(claim).SetStatus(copyrightclaim.StatusRestored).SetTargetFlag(copyrightclaim.TargetFlagVisible).SetRemedyState(copyrightclaim.RemedyStateRestored).Exec(ctx); err != nil {
			return err
		}
		if err := tx.CounterNotice.UpdateOne(notice).SetRestoredAt(moment).Exec(ctx); err != nil {
			return err
		}
		if NeedsVisibilityRestore(string(claim.Remedy), string(claim.RemedyState)) {
			if err := contentservices.PublishVisibilityChange(ctx, tx, string(claim.TargetType), claim.TargetID, infringer, "visible", "copyright", claim.ID.String(), "Counter-notice period passed", moment); err != nil {
				return err
			}
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, claimevents.ClaimRestoredType, claim.ID.String(), moment, claimevents.ClaimRestoredData{ClaimId: claim.ID.String(), TargetType: string(claim.TargetType), TargetId: claim.TargetID, InfringerId: infringer, Remedy: string(claim.Remedy), WorkTitle: claim.WorkTitle})
	})
}

func NeedsVisibilityRestore(remedy, remedyState string) bool {
	return remedyState == "taken_down" || (remedy == "" || remedy == "none") || remedy == "taken_down"
}
