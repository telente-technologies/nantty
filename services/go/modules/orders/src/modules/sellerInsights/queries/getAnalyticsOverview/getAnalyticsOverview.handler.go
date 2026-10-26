package getanalyticsoverview

import (
	"context"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/sellerInsights/dtos"
	"nantty/modules/orders/src/modules/sellerInsights/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.AnalyticsOverview, error) {
	days := query.Window.Until.Sub(query.Window.From)
	since := query.Window.From.Add(-days)
	orders, err := services.LoadStoreOrders(ctx, handler.Container, query.Store, &since)
	if err != nil {
		return dtos.AnalyticsOverview{}, err
	}
	traffic, err := services.DailyTraffic(ctx, query.Store.StoreId, since, query.Window.Until)
	if err != nil {
		return dtos.AnalyticsOverview{}, err
	}
	return orders.Overview(query.Window, traffic), nil
}
