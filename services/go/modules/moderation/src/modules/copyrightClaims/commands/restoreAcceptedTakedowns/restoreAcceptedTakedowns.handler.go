package restoreacceptedtakedowns

import (
	"context"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/events"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/copyrightclaim"
	"zudomart/modules/moderation/src/generated/ent/counternotice"
	contentservices "zudomart/modules/moderation/src/modules/contentReports/services"
	claimevents "zudomart/modules/moderation/src/modules/copyrightClaims/events"
	strikeservices "zudomart/modules/moderation/src/modules/strikes/services"
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
		if claim.StrikeID != nil {
			if _, err := (strikeservices.Recorder{Now: handler.Container.Now}).Revoke(ctx, tx, *claim.StrikeID, "Counter-notice accepted and the restoration period passed"); err != nil {
				return err
			}
		}
		if err := tx.CopyrightClaim.UpdateOne(claim).SetStatus(copyrightclaim.StatusRestored).SetTargetFlag(copyrightclaim.TargetFlagVisible).Exec(ctx); err != nil {
			return err
		}
		if err := tx.CounterNotice.UpdateOne(notice).SetRestoredAt(moment).Exec(ctx); err != nil {
			return err
		}
		if err := contentservices.PublishVisibilityChange(ctx, tx, string(claim.TargetType), claim.TargetID, infringer, "visible", "copyright", claim.ID.String(), "Counter-notice period passed", moment); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, claimevents.ClaimRestoredType, claim.ID.String(), moment, claimevents.ClaimRestoredData{ClaimId: claim.ID.String(), TargetType: string(claim.TargetType), TargetId: claim.TargetID, InfringerId: infringer})
	})
}
