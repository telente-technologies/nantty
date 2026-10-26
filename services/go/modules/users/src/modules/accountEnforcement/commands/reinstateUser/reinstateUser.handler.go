package reinstateuser

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/modules/accountEnforcement/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.UserDetail, error) {
	reason, err := services.RequireReason(command.Reason)
	if err != nil {
		return services.UserDetail{}, err
	}
	accountId := command.TargetId
	if command.SuspensionId != "" {
		if accountId, err = handler.accountOfSuspension(ctx, command.SuspensionId); err != nil {
			return services.UserDetail{}, err
		}
	}
	target, err := services.LoadTarget(ctx, handler.Container, accountId)
	if err != nil {
		return services.UserDetail{}, err
	}
	auditAction := command.AuditAction
	if auditAction == "" {
		auditAction = "user.reinstated"
	}
	if err := services.CloseActiveSuspension(ctx, handler.Container, target, command.Actor, reason, "reinstated", auditAction, ""); err != nil {
		return services.UserDetail{}, err
	}
	target.Account.Status = "active"
	return services.BuildUserDetail(ctx, handler.Container, target)
}

func (handler Handler) accountOfSuspension(ctx context.Context, raw string) (string, error) {
	suspensionId, err := uuid.Parse(raw)
	if err != nil {
		return "", usersErrors.NotFound("That case was not found.")
	}
	row, err := handler.Container.Client.AccountSuspension.Get(ctx, suspensionId)
	if ent.IsNotFound(err) {
		return "", usersErrors.NotFound("That case was not found.")
	}
	if err != nil {
		return "", err
	}
	return row.AccountID.String(), nil
}
