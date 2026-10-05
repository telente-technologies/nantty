package getsellerdashboard

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent/returnrequest"
	"zudomart/modules/orders/src/integrations"
	"zudomart/modules/orders/src/modules/sellerInsights/dtos"
	"zudomart/modules/orders/src/modules/sellerInsights/services"
	"zudomart/platform/commerceports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.DashboardSummary, error) {
	orders, err := services.LoadStoreOrders(ctx, handler.Container, query.Store, nil)
	if err != nil {
		return dtos.DashboardSummary{}, err
	}
	stock := commerceports.StockAlertSummary{}
	if reader, portError := commerceports.Default.StoreStockAlertsReader(); portError == nil {
		if stock, err = reader.StockAlertsForStore(ctx, query.Store.StoreId, query.LocationId, 8); err != nil {
			return dtos.DashboardSummary{}, err
		}
	}
	catalog := commerceports.CatalogCounts{}
	if reader, portError := commerceports.Default.StoreInsightsReader(); portError == nil {
		if catalog, err = reader.CatalogCountsForStore(ctx, query.Store.StoreId); err != nil {
			return dtos.DashboardSummary{}, err
		}
	}
	traffic, err := handler.traffic(ctx, orders)
	if err != nil {
		return dtos.DashboardSummary{}, err
	}
	returns, err := handler.Container.Client.ReturnRequest.Query().Where(returnrequest.StoreID(query.Store.StoreId), returnrequest.Status("requested")).All(ctx)
	if err != nil {
		return dtos.DashboardSummary{}, err
	}
	audit := []commerceports.StoreAuditEntryView{}
	if reader, portError := commerceports.Default.StoreAuditReader(); portError == nil {
		if audit, err = reader.RecentStoreAudit(ctx, query.Store.StoreId, 10); err != nil {
			return dtos.DashboardSummary{}, err
		}
	}
	today, week, month, lifetime := orders.SalesSummaries()
	period, periodTotals := orders.PeriodSummary(query.Period)
	var locationId *string
	if query.LocationId != nil {
		text := query.LocationId.String()
		locationId = &text
	}
	return dtos.DashboardSummary{
		Period: period, PeriodTotals: periodTotals,
		LocationId: locationId, GeneratedAt: orders.Now.UTC().Format(time.RFC3339), SalesToday: today, SalesThisWeek: week, SalesThisMonth: month, LifetimeSales: lifetime,
		OrdersByStatus: orders.StatusCounts(), DailyRevenue: orders.DailyRevenue(30), TopProducts: orders.TopProducts(orders.StartOfDay(orders.Now).AddDate(0, 0, -29), 5),
		LowStockAlerts: services.LowStockAlertsOf(stock), Traffic: traffic, CustomerGrowth: orders.CustomerGrowth(30),
		Catalog:  dtos.CatalogSummary{TotalProducts: catalog.TotalProducts, ActiveProducts: catalog.ActiveProducts, DraftProducts: catalog.DraftProducts, LowStockCount: stock.LowStockCount, OutOfStockCount: stock.OutOfStockCount},
		Balances: handler.balances(ctx, query.Store, query.ActorId), RecentOrders: orders.RecentOrders(6), Activity: orders.Activity(returns, audit, 10),
		Alerts: orders.Alerts(len(returns), handler.disputesAwaiting(ctx, query.Store), stock),
	}, nil
}

func (handler Handler) traffic(ctx context.Context, orders services.StoreOrders) (dtos.TrafficSummary, error) {
	end := orders.StartOfDay(orders.Now).AddDate(0, 0, 1)
	start, previousStart := end.AddDate(0, 0, -30), end.AddDate(0, 0, -60)
	daily, err := services.DailyTraffic(ctx, orders.Store.StoreId, previousStart, end)
	if err != nil {
		return dtos.TrafficSummary{}, err
	}
	views, visitors := services.SumTraffic(daily, start, end)
	previousViews, previousVisitors := services.SumTraffic(daily, previousStart, start)
	summary := dtos.TrafficSummary{StoreViews: views, PreviousStoreViews: previousViews, Visitors: visitors, DailyStoreViews: make([]int, 30),
		ConversionRateBasisPoints:         services.ConversionBasisPoints(orders.SalesBetween(start, end).OrdersCount, visitors),
		PreviousConversionRateBasisPoints: services.ConversionBasisPoints(orders.SalesBetween(previousStart, start).OrdersCount, previousVisitors)}
	for offset := 0; offset < 30; offset++ {
		summary.DailyStoreViews[offset] = daily[start.AddDate(0, 0, offset).UTC().Format(time.DateOnly)].StoreViews
	}
	return summary, nil
}

func (handler Handler) balances(ctx context.Context, store commerceports.StoreAccess, actorId uuid.UUID) json.RawMessage {
	if !store.Allows("wallet:view") {
		return json.RawMessage("null")
	}
	client := integrations.NewMoneySellerAccountsClient(handler.Container.Settings.MoneyInternalUrl, handler.Container.Settings.MoneyInternalToken)
	response, err := client.Forward(ctx, http.MethodGet, "/api/v1/internal/sellers/"+store.OwnerAccountId.String()+"/wallet/balances", map[string]string{
		"X-Seller-Store-Id": store.StoreId.String(), "X-Store-Currency": string(store.Currency), "X-Store-Country": store.CountryCode, "X-Store-Timezone": store.Timezone, "X-Actor-Id": actorId.String(),
	}, nil)
	if err != nil || response.Status != http.StatusOK || !json.Valid(response.Body) {
		return json.RawMessage("null")
	}
	return response.Body
}

func (handler Handler) disputesAwaiting(ctx context.Context, store commerceports.StoreAccess) int {
	client := integrations.NewMoneyDisputesClient(handler.Container.Settings.MoneyInternalUrl, handler.Container.Settings.MoneyInternalToken)
	response, err := client.Forward(ctx, http.MethodGet, "/api/v1/internal/stores/"+store.StoreId.String()+"/disputes?status=awaiting_seller&limit=100", nil, "")
	if err != nil || response.Status != http.StatusOK {
		return 0
	}
	var page struct {
		Data []json.RawMessage `json:"data"`
	}
	if json.Unmarshal(response.Body, &page) != nil {
		return 0
	}
	return len(page.Data)
}
