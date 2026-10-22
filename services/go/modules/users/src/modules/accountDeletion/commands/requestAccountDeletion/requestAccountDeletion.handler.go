package requestaccountdeletion

import (
	"context"
	"encoding/json"
	"time"

	"zudomart/modules/users/src/container"
	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/deletionrequest"
	deletionevents "zudomart/modules/users/src/modules/accountDeletion/events"
	"zudomart/modules/users/src/modules/accountDeletion/services"
	retentionservices "zudomart/modules/users/src/modules/retention/services"
	"zudomart/modules/users/src/useraudit"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (*ent.DeletionRequest, error) {
	var created *ent.DeletionRequest
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		pending, err := tx.DeletionRequest.Query().Where(deletionrequest.AccountID(command.AccountId), deletionrequest.StatusEQ(deletionrequest.StatusPending)).ForUpdate().Exist(ctx)
		if err != nil {
			return err
		}
		if pending {
			return services.ErrDeletionAlreadyRequested
		}
		policies, err := retentionservices.LoadRetentionPolicies(ctx, tx.Client())
		if err != nil {
			return err
		}
		snapshot := retentionservices.SnapshotOf(policies)
		encoded, err := json.Marshal(snapshot)
		if err != nil {
			return err
		}
		now := handler.Container.Now()
		scheduledFor := now.Add(time.Duration(handler.Container.Settings.Privacy.DeletionGraceDays) * 24 * time.Hour)
		if created, err = tx.DeletionRequest.Create().SetAccountID(command.AccountId).SetReason(command.Reason).SetScheduledFor(scheduledFor).SetRetentionSnapshot(encoded).Save(ctx); err != nil {
			return err
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, deletionevents.AccountDeletionRequestedType, command.AccountId.String(), now, deletionevents.AccountDeletionRequestedData{
			AccountId: command.AccountId.String(), RequestedAt: now.UTC().Format(time.RFC3339), ScheduledFor: scheduledFor.UTC().Format(time.RFC3339), RetentionPolicy: snapshot,
		})
	})
	if err != nil || created == nil {
		return created, err
	}
	if auditErr := useraudit.RecordUserAuditEntry(ctx, useraudit.UserAuditEntry{
		AccountId: command.AccountId.String(), Action: "user.deletion_requested", SubjectType: "deletion_request", SubjectId: created.ID.String(), Reason: command.Reason,
		After: map[string]string{"status": string(created.Status), "scheduledFor": created.ScheduledFor.UTC().Format(time.RFC3339)},
	}); auditErr != nil {
		handler.Container.Logger.WarnContext(ctx, "deletion request audit failed", "accountId", command.AccountId.String(), "error", auditErr.Error())
	}
	return created, nil
}
