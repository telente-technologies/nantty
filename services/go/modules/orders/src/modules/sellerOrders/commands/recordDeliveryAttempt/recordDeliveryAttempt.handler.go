package recorddeliveryattempt

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
	if err := handler.record(ctx, command); err != nil {
		return types.SellerOrderView{}, err
	}
	group, err := services.LoadStoreOrder(ctx, handler.Container, command.Seller.Store.StoreId, command.OrderId)
	if err != nil {
		return types.SellerOrderView{}, err
	}
	views, err := services.SellerOrderViews(ctx, handler.Container, []*ent.OrderGroup{group}, true)
	return views[0], err
}

func (handler Handler) record(ctx context.Context, command Command) error {
	if command.Outcome == "delivered" {
		return services.UpdateOrderStatus(ctx, handler.Container, command.Seller, command.OrderId, "delivered")
	}
	return services.RecordFailedDeliveryAttempt(ctx, handler.Container, command.Seller, command.OrderId, command.Note)
}
