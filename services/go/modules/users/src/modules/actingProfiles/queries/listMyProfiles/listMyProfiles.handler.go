package listmyprofiles

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
	rows, err := services.ListActiveProfilesOfAccount(ctx, handler.Container, owner)
	if err != nil {
		return Page{}, err
	}
	page := Page{Data: make([]types.ActingProfileView, 0, len(rows))}
	for _, row := range rows {
		page.Data = append(page.Data, types.BuildActingProfileView(row, activeId))
	}
	return page, nil
}
