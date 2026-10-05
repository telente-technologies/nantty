package getanalyticsbreakdowns

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/sellerInsights/dtos"
	"zudomart/modules/orders/src/modules/sellerInsights/services"
	"zudomart/platform/commerceports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.AnalyticsBreakdowns, error) {
	orders, err := services.LoadStoreOrders(ctx, handler.Container, query.Store, &query.Window.From)
	if err != nil {
		return dtos.AnalyticsBreakdowns{}, err
	}
	cards, views, stock := map[uuid.UUID]commerceports.ProductCard{}, map[uuid.UUID]int{}, map[uuid.UUID]int{}
	if reader, portError := commerceports.Default.StoreInsightsReader(); portError == nil {
		if cards, err = reader.DescribeStoreProducts(ctx, query.Store.StoreId, true); err != nil {
			return dtos.AnalyticsBreakdowns{}, err
		}
		if views, err = reader.ProductViewsForStore(ctx, query.Store.StoreId, query.Window.From, query.Window.Until); err != nil {
			return dtos.AnalyticsBreakdowns{}, err
		}
	}
	if reader, portError := commerceports.Default.StoreStockAlertsReader(); portError == nil {
		summary, stockError := reader.StockAlertsForStore(ctx, query.Store.StoreId, nil, 0)
		if stockError != nil {
			return dtos.AnalyticsBreakdowns{}, stockError
		}
		stock = summary.AvailableByProduct
	}
	return orders.Breakdowns(query.Window, cards, views, stock), nil
}
