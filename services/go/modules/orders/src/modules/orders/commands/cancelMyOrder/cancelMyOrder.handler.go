package cancelmyorder

import (
	"context"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.OrderView, error) {
	buyerId := command.BuyerId
	group, err := services.CancelOrderGroup(ctx, handler.Container, services.CancelRequest{
		OrderId: command.OrderId, Actor: services.OrderActor{Kind: enums.ActorBuyer, AccountId: &buyerId}, Reason: command.Reason, BuyerId: &buyerId,
	})
	if err != nil {
		return types.OrderView{}, err
	}
	views, err := services.BuyerOrderViews(ctx, handler.Container, []*ent.OrderGroup{group})
	return views[0], err
}
