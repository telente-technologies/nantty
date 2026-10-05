package listaddresses

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

func (handler Handler) Execute(ctx context.Context, query Query) ([]services.AddressView, error) {
	addresses, err := handler.Container.Client.ShippingAddress.Query().
		Where(shippingaddress.AccountID(query.AccountId)).
		Order(ent.Desc(shippingaddress.FieldIsDefault), ent.Desc(shippingaddress.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	return services.BuildAddressViews(ctx, handler.Container.Client, handler.Container.Settings.AddressPhoneKey, addresses)
}
