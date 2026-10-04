package services

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	cancelaccountdeletion "zudomart/modules/users/src/modules/accountDeletion/commands/cancelAccountDeletion"
	deletionservices "zudomart/modules/users/src/modules/accountDeletion/services"
)

type DeletionGraceCancelService struct {
	Container *container.Container
}

func (service DeletionGraceCancelService) CancelPendingDeletionOnLogin(ctx context.Context, accountId uuid.UUID) (bool, error) {
	_, err := cancelaccountdeletion.Handler{Container: service.Container}.Execute(ctx, cancelaccountdeletion.Command{AccountId: accountId})
	if err == nil {
		return true, nil
	}
	if errors.Is(err, deletionservices.ErrNoPendingDeletion) {
		return false, nil
	}
	return false, err
}
