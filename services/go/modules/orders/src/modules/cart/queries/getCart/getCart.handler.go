package getcart

import (
	"context"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/types"
	"nantty/platform/usersdirectory"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.CartView, error) {
	var address *usersdirectory.ShippingAddress
	if query.AddressId != nil {
		found, exists, err := handler.Container.Users.FindShippingAddress(ctx, query.AccountId, *query.AddressId)
		if err != nil {
			return types.CartView{}, err
		}
		if !exists {
			return types.CartView{}, ordererrors.AddressNotFound
		}
		address = &found
	}
	return services.BuildCartView(ctx, handler.Container, query.AccountId, address)
}
