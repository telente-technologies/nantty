package listshippingprofiles

import (
	"context"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/shippingprofile"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/types"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[types.ShippingProfileView], error) {
	empty := httpserver.CursorPage[types.ShippingProfileView]{}
	if _, err := services.EnsureDefaultShippingProfile(ctx, handler.Container, query.Store); err != nil {
		return empty, err
	}
	rows, err := handler.Container.Client.ShippingProfile.Query().Where(shippingprofile.StoreID(query.Store.StoreId)).Order(ent.Desc(shippingprofile.FieldIsDefault), ent.Asc(shippingprofile.FieldID)).All(ctx)
	if err != nil {
		return empty, err
	}
	views := make([]types.ShippingProfileView, 0, len(rows))
	for _, row := range rows {
		view, err := services.ShippingProfileViewOf(ctx, handler.Container, row)
		if err != nil {
			return empty, err
		}
		views = append(views, view)
	}
	return httpserver.NewCursorPage(views, ""), nil
}
