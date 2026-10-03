package deleteuser

import (
	"context"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/modules/accountEnforcement/services"
	usersservices "zudomart/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	reason, err := services.RequireReason(command.Reason)
	if err != nil {
		return Result{}, err
	}
	target, err := services.LoadTarget(ctx, handler.Container, command.TargetId)
	if err != nil {
		return Result{}, err
	}
	if target.Account.Status == "deleted" {
		return Result{}, usersErrors.Conflict("INVALID_STATUS", "This account has already been deleted.")
	}
	if command.ConfirmUsername != target.Account.Username {
		return Result{}, usersErrors.ValidationFailedFor("confirmUsername", "must match the username of the account")
	}
	if checker := handler.Container.PendingWithdrawals; checker != nil {
		pending, err := checker.HasPendingWithdrawals(ctx, target.Account.ID)
		if err != nil {
			return Result{}, err
		}
		if pending {
			return Result{}, usersErrors.Conflict("PENDING_WITHDRAWALS", "Settle or cancel pending withdrawals before deleting this account.")
		}
	}
	outcome, err := services.RemoveAccountDataAndAnonymize(ctx, handler.Container, target.Account.ID, target.Account.Username, derefEmail(target.Account.Email), "admin_delete", reason, command.Actor.Id)
	if err != nil {
		return Result{}, err
	}
	err = usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
		Action: "user.deleted", SubjectType: "user", SubjectId: target.Account.ID.String(), SubjectLabel: target.Label(), Reason: reason,
		Before: map[string]any{"status": target.Account.Status, "username": target.Account.Username}, After: map[string]any{"status": "deleted", "removed": outcome.Removed, "anonymizedRecords": outcome.AnonymizedRecords, "retainedUntil": outcome.RetainedUntil},
	})
	if err != nil {
		return Result{}, err
	}
	target.Account.Status, target.Account.Username, target.Profile = "deleted", "", nil
	detail, err := services.BuildUserDetail(ctx, handler.Container, target)
	return Result{UserDetail: detail, Deletion: outcome}, err
}

func derefEmail(email *string) string {
	if email == nil {
		return ""
	}
	return *email
}
