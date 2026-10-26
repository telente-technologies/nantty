package getuserprofile

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	celebrationservices "nantty/modules/users/src/modules/celebrations/services"
	"nantty/modules/users/src/services"
	"nantty/modules/users/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.UserView, error) {
	target, err := uuid.Parse(query.AccountId)
	if err != nil {
		return types.UserView{}, usersErrors.ErrProfileNotFound
	}
	return ViewPublicProfileOfAccount(ctx, handler.Container, target)
}

func ViewPublicProfileOfAccount(ctx context.Context, application *container.Container, accountId uuid.UUID) (types.UserView, error) {
	row, summary, err := services.EnsurePersonalProfile(ctx, application, accountId)
	if err == usersErrors.ErrAccountUnavailable {
		return types.UserView{}, usersErrors.ErrProfileNotFound
	}
	if err != nil {
		return types.UserView{}, err
	}
	view := types.BuildUserView(row, summary, false)
	if err := services.ApplyPublicProfileKind(ctx, application.Client, &view, accountId); err != nil {
		return types.UserView{}, err
	}
	flags := celebrationservices.ComputePublicFlags(ctx, application, summary, false)
	view.BirthdayToday, view.AnniversaryToday = flags.BirthdayToday, flags.AnniversaryToday
	return view, nil
}
