package checkoutcart

import (
	"context"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.CheckoutResultView, error) {
	return (services.CheckoutService{Container: handler.Container}).Checkout(ctx, command.Request)
}
