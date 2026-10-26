package listmyprofiles

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Page, error) {
	owner, err := uuid.Parse(query.AccountId)
	if err != nil {
		return Page{}, usersErrors.ErrAccountUnavailable
	}
	personal, _, err := services.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return Page{}, err
	}
	activeId, err := services.ActiveProfileIdFor(ctx, handler.Container, owner, personal)
	if err != nil {
		return Page{}, err
	}
	views, err := services.ListOwnedActingProfiles(ctx, handler.Container, owner, personal, activeId)
	if err != nil {
		return Page{}, err
	}
	return Page{Data: views}, nil
}
