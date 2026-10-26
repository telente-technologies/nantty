package getuserdetail

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/accountEnforcement/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, userId string) (services.UserDetail, error) {
	target, err := services.LoadTarget(ctx, handler.Container, userId)
	if err != nil {
		return services.UserDetail{}, err
	}
	return services.BuildUserDetail(ctx, handler.Container, target)
}
