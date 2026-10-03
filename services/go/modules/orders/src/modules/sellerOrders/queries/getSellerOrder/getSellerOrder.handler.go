package getsellerorder

import (
	"context"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/enums"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/services"
	"zudomart/modules/orders/src/types"
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
