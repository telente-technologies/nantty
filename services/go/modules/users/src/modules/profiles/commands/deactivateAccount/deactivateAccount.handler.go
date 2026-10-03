package deactivateaccount

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	owner, err := uuid.Parse(command.AccountId)
	if err != nil {
		return usersErrors.ErrAccountUnavailable
	}
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return err
	}
	return directory.DeactivateAccountAndRevokeSessions(ctx, owner)
}
