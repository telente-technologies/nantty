package checkoutcart

import (
	"context"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/services"
	"zudomart/modules/orders/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.CheckoutResultView, error) {
	return (services.CheckoutService{Container: handler.Container}).Checkout(ctx, command.Request)
}
