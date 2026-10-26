package services

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent/deletionrequest"
	cancelaccountdeletion "nantty/modules/users/src/modules/accountDeletion/commands/cancelAccountDeletion"
	deletionservices "nantty/modules/users/src/modules/accountDeletion/services"
)

type DeletionGraceCancelService struct {
	Container *container.Container
}

func (service DeletionGraceCancelService) AccountDeletionExecuted(ctx context.Context, accountId uuid.UUID) (bool, error) {
	return service.Container.Client.DeletionRequest.Query().Where(deletionrequest.AccountID(accountId), deletionrequest.StatusEQ(deletionrequest.StatusExecuted)).Exist(ctx)
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
