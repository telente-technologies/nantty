package cancelaccountdeletion

import (
	"context"
	"time"

	"zudomart/modules/users/src/container"
	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/deletionrequest"
	deletionevents "zudomart/modules/users/src/modules/accountDeletion/events"
	"zudomart/modules/users/src/modules/accountDeletion/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (*ent.DeletionRequest, error) {
	var cancelled *ent.DeletionRequest
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := handler.Container.Now()
		pending, err := tx.DeletionRequest.Query().Where(deletionrequest.AccountID(command.AccountId), deletionrequest.StatusEQ(deletionrequest.StatusPending), deletionrequest.ScheduledForGT(now)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return services.ErrNoPendingDeletion
		}
		if err != nil {
			return err
		}
		if cancelled, err = pending.Update().SetStatus(deletionrequest.StatusCancelled).SetCancelledAt(now).Save(ctx); err != nil {
			return err
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, deletionevents.AccountDeletionCancelledType, command.AccountId.String(), now, deletionevents.AccountDeletionCancelledData{
			AccountId: command.AccountId.String(), CancelledAt: now.UTC().Format(time.RFC3339),
		})
	})
	return cancelled, err
}
