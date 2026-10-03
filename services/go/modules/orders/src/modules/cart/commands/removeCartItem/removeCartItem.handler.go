package removecartitem

import (
	"context"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/services"
	"zudomart/modules/orders/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.CartView, error) {
	item, err := services.FindOwnedCartItem(ctx, handler.Container.Client, command.AccountId, command.ItemId)
	if err != nil {
		return types.CartView{}, err
	}
	if err := handler.Container.Client.CartItem.DeleteOne(item).Exec(ctx); err != nil {
		return types.CartView{}, err
	}
	return services.BuildCartView(ctx, handler.Container, command.AccountId, nil)
}
