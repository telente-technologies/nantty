package services

import (
	"context"

	"zudomart/modules/users/src/container"
	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/accountban"
	usersservices "zudomart/modules/users/src/services"
	"zudomart/modules/users/src/types"
	"zudomart/platform/identityports"
)

func LiftActiveBan(ctx context.Context, application *container.Container, target Target, actor types.StaffActor, reason, auditAction string) error {
	enforcement, err := identityports.Default.AccountEnforcement()
	if err != nil {
		return err
	}
	if err := enforcement.LiftBan(ctx, target.Account.ID); err != nil {
		return err
	}
	now := application.Now()
	return application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := tx.AccountBan.Update().Where(accountban.AccountID(target.Account.ID), accountban.LiftedAtIsNil()).SetLiftedAt(now).SetLiftedBy(actor.Id).Save(ctx); err != nil {
			return err
		}
		if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, "user.unbanned", target.Account.ID.String(), now, map[string]any{"accountId": target.Account.ID.String()}); err != nil {
			return err
		}
		if actor.Id == "" {
			return nil
		}
		return usersservices.RecordStaffAuditEntry(ctx, actor, usersservices.StaffAuditEntry{
			Action: auditAction, SubjectType: "user", SubjectId: target.Account.ID.String(), SubjectLabel: target.Label(), Reason: reason,
			Before: map[string]any{"status": "banned"}, After: map[string]any{"status": "active", "reSignupBlocksCleared": true},
		})
	})
}
