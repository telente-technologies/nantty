package liststorelocations

import (
	"context"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/generated/ent/stocklocation"
	"nantty/modules/inventory/src/services"
	"nantty/modules/inventory/src/types"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[types.StoreLocationView], error) {
	rows, err := handler.Container.Client.StockLocation.Query().Where(stocklocation.StoreID(query.StoreId)).
		Order(ent.Desc(stocklocation.FieldIsDefault), ent.Asc(stocklocation.FieldName)).All(ctx)
	if err != nil {
		return httpserver.CursorPage[types.StoreLocationView]{}, err
	}
	views := make([]types.StoreLocationView, 0, len(rows))
	for _, row := range rows {
		views = append(views, services.LocationView(row))
	}
	return httpserver.NewCursorPage(views, ""), nil
}
