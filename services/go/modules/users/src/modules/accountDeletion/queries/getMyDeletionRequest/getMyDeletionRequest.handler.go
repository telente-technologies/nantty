package getmydeletionrequest

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/deletionrequest"
	"nantty/modules/users/src/modules/accountDeletion/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (*ent.DeletionRequest, error) {
	row, err := handler.Container.Client.DeletionRequest.Query().Where(deletionrequest.AccountID(query.AccountId)).Order(ent.Desc(deletionrequest.FieldID)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, services.ErrNoPendingDeletion
	}
	return row, err
}
