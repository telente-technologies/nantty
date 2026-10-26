package listcustomersegments

import (
	"context"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/services"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[services.SegmentView], error) {
	customers, err := services.LoadStoreCustomers(ctx, handler.Container, query.Store.StoreId, query.Store.Currency)
	if err != nil {
		return httpserver.CursorPage[services.SegmentView]{}, err
	}
	definitions, err := services.LoadSegmentDefinitions(ctx, handler.Container, query.Store.StoreId, customers)
	if err != nil {
		return httpserver.CursorPage[services.SegmentView]{}, err
	}
	views := make([]services.SegmentView, 0, len(definitions))
	for _, definition := range definitions {
		views = append(views, definition.Present(customers, query.Store.Currency))
	}
	return httpserver.NewCursorPage(views, ""), nil
}
