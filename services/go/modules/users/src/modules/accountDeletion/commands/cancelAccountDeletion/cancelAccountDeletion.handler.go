package cancelaccountdeletion

import (
	"context"
	"time"

	"nantty/modules/users/src/container"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/deletionrequest"
	deletionevents "nantty/modules/users/src/modules/accountDeletion/events"
	"nantty/modules/users/src/modules/accountDeletion/services"
	"nantty/modules/users/src/useraudit"
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
	if err != nil || cancelled == nil {
		return cancelled, err
	}
	if auditErr := useraudit.RecordUserAuditEntry(ctx, useraudit.UserAuditEntry{
		AccountId: command.AccountId.String(), Action: "user.deletion_cancelled", SubjectType: "deletion_request", SubjectId: cancelled.ID.String(), Reason: "user_cancelled",
		Before: map[string]string{"status": "pending"}, After: map[string]string{"status": string(cancelled.Status)},
	}); auditErr != nil {
		handler.Container.Logger.WarnContext(ctx, "deletion cancellation audit failed", "accountId", command.AccountId.String(), "error", auditErr.Error())
	}
	return cancelled, nil
}
