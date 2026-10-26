package getmyprofile

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
	owner, err := uuid.Parse(query.AccountId)
	if err != nil {
		return types.UserView{}, usersErrors.ErrAccountUnavailable
	}
	row, summary, err := services.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return types.UserView{}, err
	}
	view := types.BuildUserView(row, summary, true)
	if err := services.ApplyPublicProfileKind(ctx, handler.Container.Client, &view, owner); err != nil {
		return types.UserView{}, err
	}
	flags := celebrationservices.ComputePublicFlags(ctx, handler.Container, summary, true)
	view.BirthdayToday, view.AnniversaryToday = flags.BirthdayToday, flags.AnniversaryToday
	if handler.Container.OwnedStores != nil {
		storeId, err := handler.Container.OwnedStores.FindOwnedStoreId(ctx, owner)
		if err != nil {
			handler.Container.Logger.WarnContext(ctx, "owned store lookup failed; /users/me is served without storeId", "accountId", owner.String(), "error", err.Error())
		}
		view.StoreId = storeId
	}
	return view, nil
}
