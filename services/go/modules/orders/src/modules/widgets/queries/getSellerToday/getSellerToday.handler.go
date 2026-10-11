package getsellertoday

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/enums"
	"zudomart/modules/orders/src/generated/ent/ordergroup"
	"zudomart/modules/orders/src/integrations"
	insightservices "zudomart/modules/orders/src/modules/sellerInsights/services"
	"zudomart/modules/orders/src/modules/widgets/dtos"
	widgetservices "zudomart/modules/orders/src/modules/widgets/services"
	"zudomart/platform/money"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.SellerTodayWidgetPayload, error) {
	now := handler.Container.Now()
	startOfDay := startOfLocalDay(now, query.Store.Timezone)
	todays, err := insightservices.LoadStoreOrders(ctx, handler.Container, query.Store, &startOfDay)
	if err != nil {
		return dtos.SellerTodayWidgetPayload{}, err
	}
	sales := todays.SalesBetween(startOfDay, now.Add(time.Second))
	toShip, err := handler.Container.Client.OrderGroup.Query().
		Where(ordergroup.StoreID(query.Store.StoreId), ordergroup.PaymentStatusNEQ(enums.PaymentPending), ordergroup.StatusIn(widgetservices.SellerStatusesAwaitingShipment...)).Count(ctx)
	if err != nil {
		return dtos.SellerTodayWidgetPayload{}, err
	}
	payload := dtos.SellerTodayWidgetPayload{
		StoreName: query.Store.StoreName, OrdersToday: sales.OrdersCount, OrdersToShip: toShip, AmountsHidden: query.AmountsHidden,
		DeepLink: widgetservices.SellerDashboardDeepLink, GeneratedAt: now.UTC().Format(time.RFC3339),
	}
	if query.AmountsHidden {
		return payload, nil
	}
	salesToday := money.Money{AmountMinor: sales.GrossMinor, Currency: query.Store.Currency}
	payload.SalesToday = &salesToday
	payload.AvailableBalance = handler.availableBalance(ctx, query)
	return payload, nil
}

func startOfLocalDay(moment time.Time, timezone string) time.Time {
	location, err := time.LoadLocation(timezone)
	if err != nil || timezone == "" {
		location = time.UTC
	}
	local := moment.In(location)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, location)
}

func (handler Handler) availableBalance(ctx context.Context, query Query) *money.Money {
	if !query.Store.Allows("wallet:view") || handler.Container.Settings.MoneyInternalUrl == "" {
		return nil
	}
	client := integrations.NewMoneySellerAccountsClient(handler.Container.Settings.MoneyInternalUrl, handler.Container.Settings.MoneyInternalToken)
	response, err := client.Forward(ctx, http.MethodGet, "/api/v1/internal/sellers/"+query.Store.OwnerAccountId.String()+"/wallet/balances", map[string]string{
		"X-Seller-Store-Id": query.Store.StoreId.String(), "X-Store-Currency": string(query.Store.Currency), "X-Store-Country": query.Store.CountryCode, "X-Store-Timezone": query.Store.Timezone, "X-Actor-Id": query.ActorId.String(),
	}, nil)
	if err != nil || response.Status != http.StatusOK {
		return nil
	}
	return ParseAvailableBalance(response.Body)
}

func ParseAvailableBalance(body []byte) *money.Money {
	var balances struct {
		Available *money.Money `json:"available"`
	}
	if json.Unmarshal(body, &balances) != nil || balances.Available == nil || balances.Available.Currency == "" {
		return nil
	}
	return balances.Available
}
