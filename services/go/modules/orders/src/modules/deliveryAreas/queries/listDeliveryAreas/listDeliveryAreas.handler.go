package listdeliveryareas

import (
	"context"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/deliveryarea"
	"nantty/modules/orders/src/modules/deliveryAreas/dtos"
	"nantty/modules/orders/src/modules/deliveryAreas/services"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.DeliveryAreaView], error) {
	rows, err := handler.Container.Client.DeliveryArea.Query().Where(deliveryarea.StoreID(query.Store.StoreId)).Order(ent.Asc(deliveryarea.FieldID)).All(ctx)
	if err != nil {
		return httpserver.CursorPage[dtos.DeliveryAreaView]{}, err
	}
	views := make([]dtos.DeliveryAreaView, 0, len(rows))
	for _, row := range rows {
		views = append(views, services.PresentDeliveryArea(row))
	}
	return httpserver.NewCursorPage(views, ""), nil
}
