package getmyorder

import (
	"context"

	"zudomart/modules/orders/src/container"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/ordergroup"
	"zudomart/modules/orders/src/services"
	"zudomart/modules/orders/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.OrderView, error) {
	group, err := handler.Container.Client.OrderGroup.Query().Where(ordergroup.ID(query.OrderId), ordergroup.BuyerAccountID(query.BuyerId)).Only(ctx)
	if ent.IsNotFound(err) {
		return types.OrderView{}, ordererrors.OrderNotFound
	}
	if err != nil {
		return types.OrderView{}, err
	}
	views, err := services.BuyerOrderViews(ctx, handler.Container, []*ent.OrderGroup{group})
	return views[0], err
}
