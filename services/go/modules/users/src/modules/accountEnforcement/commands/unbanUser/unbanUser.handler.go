package unbanuser

import (
	"context"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
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
	target, err := services.LoadTarget(ctx, handler.Container, command.TargetId)
	if err != nil {
		return services.UserDetail{}, err
	}
	if target.Account.Status != "banned" {
		return services.UserDetail{}, usersErrors.Conflict("NOT_BANNED", "This account is not banned.")
	}
	if err := services.LiftActiveBan(ctx, handler.Container, target, command.Actor, reason, "user.unbanned"); err != nil {
		return services.UserDetail{}, err
	}
	target.Account.Status = "active"
	return services.BuildUserDetail(ctx, handler.Container, target)
}
