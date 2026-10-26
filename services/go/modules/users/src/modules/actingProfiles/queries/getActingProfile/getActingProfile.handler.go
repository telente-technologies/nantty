package getactingprofile

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/services"
	"nantty/modules/users/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.ActingProfileView, error) {
	owner, err := uuid.Parse(query.AccountId)
	if err != nil {
		return types.ActingProfileView{}, usersErrors.ErrAccountUnavailable
	}
	personal, _, err := services.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return types.ActingProfileView{}, err
	}
	activeId, err := services.ActiveProfileIdFor(ctx, handler.Container, owner, personal)
	if err != nil {
		return types.ActingProfileView{}, err
	}
	views, err := services.ListOwnedActingProfiles(ctx, handler.Container, owner, personal, activeId)
	if err != nil {
		return types.ActingProfileView{}, err
	}
	for _, view := range views {
		if view.Id == activeId {
			return view, nil
		}
	}
	return types.BuildActingProfileView(personal, personal.ID.String()), nil
}
