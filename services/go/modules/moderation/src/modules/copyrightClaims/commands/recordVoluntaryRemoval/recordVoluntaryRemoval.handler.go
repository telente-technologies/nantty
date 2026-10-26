package recordvoluntaryremoval

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/events"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/copyrightclaim"
	healthservices "nantty/modules/moderation/src/modules/accountHealth/services"
	claimevents "nantty/modules/moderation/src/modules/copyrightClaims/events"
	"nantty/modules/moderation/src/modules/copyrightClaims/services"
)

type Command struct {
	TargetId  string
	RemovedAt time.Time
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (int, error) {
	recorded := 0
	accounts := map[uuid.UUID]bool{}
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		claims, err := tx.CopyrightClaim.Query().Where(
			copyrightclaim.TargetID(command.TargetId), copyrightclaim.TargetTypeIn(copyrightclaim.TargetTypeClip, copyrightclaim.TargetTypePost), copyrightclaim.RemedyStateEQ(copyrightclaim.RemedyStateAwaitingRemoval),
		).ForUpdate().All(ctx)
		if err != nil {
			return err
		}
		for _, claim := range claims {
			if !services.CanRecordVoluntaryRemoval(string(claim.RemedyState), claim.TakedownDeadlineAt, command.RemovedAt) {
				continue
			}
			if err := tx.CopyrightClaim.UpdateOne(claim).SetRemedyState(copyrightclaim.RemedyStateRemovedVoluntarily).Exec(ctx); err != nil {
				return err
			}
			data := claimevents.RemedyData{ClaimId: claim.ID.String(), TargetType: string(claim.TargetType), TargetId: claim.TargetID, WorkTitle: claim.WorkTitle, Reason: "Removed by the uploader before the deadline"}
			if claim.InfringerID != nil {
				data.InfringerId = claim.InfringerID.String()
				accounts[*claim.InfringerID] = true
			}
			if err := events.EnqueueOutboxEventInTransaction(ctx, tx, claimevents.RemovedVoluntarilyType, claim.ID.String(), handler.Container.Now(), data); err != nil {
				return err
			}
			recorded++
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	for account := range accounts {
		if _, healthErr := healthservices.PublishHealthChanged(ctx, handler.Container, account, "copyright_content_removed_voluntarily"); healthErr != nil {
			handler.Container.Logger.WarnContext(ctx, "account health event failed", "error", healthErr.Error())
		}
	}
	return recorded, nil
}
