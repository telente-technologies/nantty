package services

import (
	"context"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/accountsuspension"
	accountevents "nantty/modules/users/src/modules/accountEnforcement/events"
	usersservices "nantty/modules/users/src/services"
	"nantty/modules/users/src/types"
	"nantty/platform/identityports"
)

func FindActiveSuspension(ctx context.Context, application *container.Container, target Target) (*ent.AccountSuspension, error) {
	row, err := application.Client.AccountSuspension.Query().Where(accountsuspension.AccountID(target.Account.ID), accountsuspension.StatusEQ(accountsuspension.StatusActive)).Order(ent.Desc(accountsuspension.FieldID)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, usersErrors.Conflict("NOT_SUSPENDED", "This account is not suspended.")
	}
	return row, err
}

func CloseActiveSuspension(ctx context.Context, application *container.Container, target Target, actor types.StaffActor, reason, outcome, auditAction string, appealStatus accountsuspension.AppealStatus) error {
	suspension, err := FindActiveSuspension(ctx, application, target)
	if err != nil {
		return err
	}
	enforcement, err := identityports.Default.AccountEnforcement()
	if err != nil {
		return err
	}
	if err := enforcement.ReinstateAccount(ctx, target.Account.ID); err != nil {
		return err
	}
	now := application.Now()
	err = application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.AccountSuspension.UpdateOne(suspension).SetStatus(accountsuspension.StatusReinstated).SetClosedAt(now)
		if appealStatus != "" {
			update.SetAppealStatus(appealStatus).SetAppealDecisionNote(reason).SetAppealDecidedBy(actor.Id)
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, accountevents.SuspensionEndedType, target.Account.ID.String(), now, accountevents.SuspensionEndedData{
			AccountId: target.Account.ID.String(), SuspensionId: suspension.ID.String(), Outcome: outcome,
		}); err != nil {
			return err
		}
		if actor.Id == "" {
			return nil
		}
		return usersservices.RecordStaffAuditEntry(ctx, actor, usersservices.StaffAuditEntry{
			Action: auditAction, SubjectType: "user", SubjectId: target.Account.ID.String(), SubjectLabel: target.Label(), Reason: reason,
			Before: map[string]any{"status": "suspended", "caseId": suspension.ID}, After: map[string]any{"status": "active", "outcome": outcome},
		})
	})
	if err != nil {
		_ = enforcement.SuspendAccountAndRevokeSessions(ctx, target.Account.ID)
	}
	return err
}
