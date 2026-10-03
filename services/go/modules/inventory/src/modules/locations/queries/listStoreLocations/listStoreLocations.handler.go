package liststorelocations

import (
	"context"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/generated/ent"
	"zudomart/modules/inventory/src/generated/ent/stocklocation"
	"zudomart/modules/inventory/src/services"
	"zudomart/modules/inventory/src/types"
	"zudomart/platform/httpserver"
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
