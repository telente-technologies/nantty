package enforcetakedowndeadlines

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/events"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/copyrightclaim"
	healthservices "nantty/modules/moderation/src/modules/accountHealth/services"
	claimevents "nantty/modules/moderation/src/modules/copyrightClaims/events"
	"nantty/modules/moderation/src/modules/copyrightClaims/services"
)

const deadlineReason = "The content was not removed before the copyright takedown deadline"

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context) (int, error) {
	now := handler.Container.Now()
	due, err := handler.Container.Client.CopyrightClaim.Query().Where(
		copyrightclaim.RemedyStateEQ(copyrightclaim.RemedyStateAwaitingRemoval), copyrightclaim.StatusEQ(copyrightclaim.StatusUpheld), copyrightclaim.TakedownDeadlineAtLTE(now),
	).Limit(100).All(ctx)
	if err != nil || len(due) == 0 {
		return 0, err
	}
	settings, err := services.LoadPolicySettings(ctx, handler.Container.Client)
	if err != nil {
		return 0, err
	}
	takenDown := 0
	for _, candidate := range due {
		strike, err := handler.takeDown(ctx, candidate.ID, settings)
		if err != nil {
			return takenDown, err
		}
		if strike == nil {
			continue
		}
		takenDown++
		if enforceErr := healthservices.EnforceCopyrightStanding(ctx, handler.Container, strike.AccountID, strike.ID.String()); enforceErr != nil {
			handler.Container.Logger.WarnContext(ctx, "copyright standing enforcement failed", "error", enforceErr.Error())
		}
	}
	return takenDown, nil
}

func (handler Handler) takeDown(ctx context.Context, claimId uuid.UUID, settings services.PolicySettings) (*ent.Strike, error) {
	var issued *ent.Strike
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		claim, err := tx.CopyrightClaim.Query().Where(copyrightclaim.IDEQ(claimId)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		now := handler.Container.Now()
		if !services.IsTakedownOverdue(string(claim.RemedyState), string(claim.Status), claim.TakedownDeadlineAt, now) {
			return nil
		}
		strike, err := services.TakeDownWithStrike(ctx, tx, claim, deadlineReason, "hidden", "system", "Copyright policy", settings, handler.Container.Now)
		if err != nil {
			return err
		}
		update := tx.CopyrightClaim.UpdateOne(claim).SetRemedyState(copyrightclaim.RemedyStateTakenDown).SetTargetFlag(copyrightclaim.TargetFlagTakenDown)
		data := claimevents.RemedyData{ClaimId: claim.ID.String(), TargetType: string(claim.TargetType), TargetId: claim.TargetID, WorkTitle: claim.WorkTitle, Reason: deadlineReason, CanCounter: claim.InfringerID != nil}
		if claim.InfringerID != nil {
			data.InfringerId = claim.InfringerID.String()
		}
		if strike != nil {
			update.SetStrikeID(strike.ID)
			data.StrikeId = strike.ID.String()
			issued = strike
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, claimevents.ContentTakenDownType, claim.ID.String(), now, data)
	})
	return issued, err
}
