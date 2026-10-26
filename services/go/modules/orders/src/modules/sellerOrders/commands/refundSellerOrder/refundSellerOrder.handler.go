package refundsellerorder

import (
	"context"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.SellerOrderView, error) {
	request := services.SellerRefundRequest{AmountMinor: command.AmountMinor, Reason: command.Reason}
	if err := services.RefundSellerOrder(ctx, handler.Container, command.Seller, command.OrderId, request); err != nil {
		return types.SellerOrderView{}, err
	}
	group, err := services.LoadStoreOrder(ctx, handler.Container, command.Seller.Store.StoreId, command.OrderId)
	if err != nil {
		return types.SellerOrderView{}, err
	}
	views, err := services.SellerOrderViews(ctx, handler.Container, []*ent.OrderGroup{group}, true)
	return views[0], err
}
