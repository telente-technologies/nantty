package setfreeshippingthreshold

import (
	"context"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/services"
	"zudomart/modules/orders/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.ShippingProfileView, error) {
	profile, err := services.EnsureDefaultShippingProfile(ctx, handler.Container, command.Store)
	if err != nil {
		return types.ShippingProfileView{}, err
	}
	update := profile.Update().SetNillableFreeShippingThresholdMinor(command.ThresholdMinor)
	if command.ThresholdMinor == nil {
		update.ClearFreeShippingThresholdMinor()
	}
	updated, err := update.Save(ctx)
	if err != nil {
		return types.ShippingProfileView{}, err
	}
	return services.ShippingProfileViewOf(ctx, handler.Container, updated)
}
