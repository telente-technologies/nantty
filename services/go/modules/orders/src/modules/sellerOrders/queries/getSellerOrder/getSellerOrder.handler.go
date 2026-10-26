package getsellerorder

import (
	"context"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/enums"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.SellerOrderView, error) {
	group, err := services.LoadStoreOrder(ctx, handler.Container, query.StoreId, query.OrderId)
	if err != nil {
		return types.SellerOrderView{}, err
	}
	if group.PaymentStatus == enums.PaymentPending {
		return types.SellerOrderView{}, ordererrors.OrderNotFound
	}
	views, err := services.SellerOrderViews(ctx, handler.Container, []*ent.OrderGroup{group}, true)
	return views[0], err
}
