package getshippingprofile

import (
	"context"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.ShippingProfileView, error) {
	profile, err := services.EnsureDefaultShippingProfile(ctx, handler.Container, query.Store)
	if err != nil {
		return types.ShippingProfileView{}, err
	}
	return services.ShippingProfileViewOf(ctx, handler.Container, profile)
}
