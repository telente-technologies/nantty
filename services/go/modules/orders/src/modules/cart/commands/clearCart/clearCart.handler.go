package clearcart

import (
	"context"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent/cart"
	"zudomart/modules/orders/src/generated/ent/cartitem"
	"zudomart/modules/orders/src/services"
	"zudomart/modules/orders/src/types"
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
