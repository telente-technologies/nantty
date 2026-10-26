package changecartitemquantity

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.CartView, error) {
	item, err := services.FindOwnedCartItem(ctx, handler.Container.Client, command.AccountId, command.ItemId)
	if err != nil {
		return types.CartView{}, err
	}
	if stock, stockError := handler.Container.Stock(); stockError == nil {
		available, err := stock.AvailableByVariant(ctx, []uuid.UUID{item.VariantID})
		if err != nil {
			return types.CartView{}, err
		}
		if available[item.VariantID] < command.Quantity {
			return types.CartView{}, ordererrors.InsufficientStock
		}
	}
	if err := item.Update().SetQuantity(command.Quantity).Exec(ctx); err != nil {
		return types.CartView{}, err
	}
	return services.BuildCartView(ctx, handler.Container, command.AccountId, nil)
}
