package confirmorderreceipt

import (
	"context"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/enums"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.OrderView, error) {
	group, err := handler.Container.Client.OrderGroup.Query().Where(ordergroup.ID(command.OrderId), ordergroup.BuyerAccountID(command.BuyerId)).Only(ctx)
	if ent.IsNotFound(err) {
		return types.OrderView{}, ordererrors.OrderNotFound
	}
	if err != nil {
		return types.OrderView{}, err
	}
	if group.Status == enums.StatusDelivered {
		if _, err := handler.Container.Money.ConfirmOrderReceipt(ctx, group.ID.String(), command.BuyerId.String()); err != nil {
			return types.OrderView{}, err
		}
		if err := services.CompleteOrderGroup(ctx, handler.Container, group.ID, services.OrderActor{Kind: enums.ActorBuyer, AccountId: &command.BuyerId, Name: group.BuyerName}, "Buyer confirmed receipt"); err != nil {
			return types.OrderView{}, err
		}
	} else if group.Status != enums.StatusCompleted {
		return types.OrderView{}, ordererrors.OrderNotConfirmable
	}
	group, err = handler.Container.Client.OrderGroup.Get(ctx, command.OrderId)
	if err != nil {
		return types.OrderView{}, err
	}
	views, err := services.BuyerOrderViews(ctx, handler.Container, []*ent.OrderGroup{group})
	return views[0], err
}
