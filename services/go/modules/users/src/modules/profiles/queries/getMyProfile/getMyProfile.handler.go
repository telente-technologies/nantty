package getmyprofile

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/services"
	"zudomart/modules/users/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.UserView, error) {
	owner, err := uuid.Parse(query.AccountId)
	if err != nil {
		return types.UserView{}, usersErrors.ErrAccountUnavailable
	}
	row, summary, err := services.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return types.UserView{}, err
	}
	return types.BuildUserView(row, summary, true), nil
}
