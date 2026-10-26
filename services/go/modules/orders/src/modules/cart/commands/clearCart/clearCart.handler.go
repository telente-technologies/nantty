package clearcart

import (
	"context"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent/cart"
	"nantty/modules/orders/src/generated/ent/cartitem"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.CartView, error) {
	row, err := handler.Container.Client.Cart.Query().Where(cart.AccountID(command.AccountId)).Only(ctx)
	if err == nil {
		if _, err := handler.Container.Client.CartItem.Delete().Where(cartitem.CartID(row.ID)).Exec(ctx); err != nil {
			return types.CartView{}, err
		}
	}
	return services.BuildCartView(ctx, handler.Container, command.AccountId, nil)
}
