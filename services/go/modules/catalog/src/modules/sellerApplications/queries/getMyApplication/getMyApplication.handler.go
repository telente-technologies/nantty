package getmyapplication

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/sellerapplication"
	applicationservices "zudomart/modules/catalog/src/modules/sellerApplications/services"
)

type Query struct {
	AccountId uuid.UUID
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (*applicationservices.MyApplication, error) {
	row, err := handler.Container.Client.SellerApplication.Query().Where(sellerapplication.AccountID(query.AccountId)).Order(ent.Desc(sellerapplication.FieldID)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	view := applicationservices.PresentMine(row)
	return &view, nil
}
