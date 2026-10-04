package getmyprofile

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	celebrationservices "zudomart/modules/users/src/modules/celebrations/services"
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
	view := types.BuildUserView(row, summary, true)
	flags := celebrationservices.ComputePublicFlags(ctx, handler.Container, summary, true)
	view.BirthdayToday, view.AnniversaryToday = flags.BirthdayToday, flags.AnniversaryToday
	return view, nil
}
