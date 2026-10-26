package getmyorder

import (
	"context"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/types"
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
	if err != nil {
		return types.OrderView{}, err
	}
	if len(views) == 0 {
		return types.OrderView{}, ordererrors.OrderNotFound
	}
	return views[0], nil
}
