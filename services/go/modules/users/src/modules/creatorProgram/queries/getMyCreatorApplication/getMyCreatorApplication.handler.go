package getmycreatorapplication

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/creatorapplication"
	"nantty/modules/users/src/modules/creatorProgram/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, accountId string) (*services.ApplicationView, error) {
	owner, err := uuid.Parse(accountId)
	if err != nil {
		return nil, usersErrors.ErrAccountUnavailable
	}
	row, err := handler.Container.Client.CreatorApplication.Query().Where(creatorapplication.AccountID(owner)).Order(ent.Desc(creatorapplication.FieldID)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	view := services.ConvertApplicationToView(row)
	return &view, nil
}
