package getaddress

import (
	"context"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/shippingaddress"
	"zudomart/modules/users/src/modules/addresses/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (services.AddressView, error) {
	address, err := handler.Container.Client.ShippingAddress.Query().Where(shippingaddress.ID(query.AddressId), shippingaddress.AccountID(query.AccountId)).Only(ctx)
	if ent.IsNotFound(err) {
		return services.AddressView{}, services.ErrAddressNotFound
	}
	if err != nil {
		return services.AddressView{}, err
	}
	views, err := services.BuildAddressViews(ctx, handler.Container.Client, handler.Container.Settings.AddressPhoneKey, []*ent.ShippingAddress{address})
	if err != nil {
		return services.AddressView{}, err
	}
	return views[0], nil
}
