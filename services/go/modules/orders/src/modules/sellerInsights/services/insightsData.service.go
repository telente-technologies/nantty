package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/enums"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/ordergroup"
	orderservices "zudomart/modules/orders/src/services"
	"zudomart/platform/commerceports"
	"zudomart/platform/money"
)

type StoreOrders struct {
	Store    commerceports.StoreAccess
	Location *time.Location
	Now      time.Time
	Groups   []*ent.OrderGroup
	Items    map[uuid.UUID][]*ent.OrderItem
}

func LoadStoreOrders(ctx context.Context, deployed *container.Container, store commerceports.StoreAccess, since *time.Time) (StoreOrders, error) {
	location, err := time.LoadLocation(store.Timezone)
	if err != nil || store.Timezone == "" {
		location = time.UTC
	}
	query := deployed.Client.OrderGroup.Query().Where(ordergroup.StoreID(store.StoreId), ordergroup.PaymentStatusNEQ(enums.PaymentPending))
	if since != nil {
		query = query.Where(ordergroup.CreatedAtGTE(*since))
	}
	groups, err := query.Order(ent.Asc(ordergroup.FieldID)).All(ctx)
	if err != nil {
		return StoreOrders{}, err
	}
	items, err := orderservices.LoadItemsByGroup(ctx, deployed, orderservices.UniqueIdentifiers(groups, func(group *ent.OrderGroup) uuid.UUID { return group.ID }))
	if err != nil {
		return StoreOrders{}, err
	}
	return StoreOrders{Store: store, Location: location, Now: deployed.Now(), Groups: groups, Items: items}, nil
}

func IsCountedSale(group *ent.OrderGroup) bool {
	return group.Status != enums.StatusCancelled && group.Status != enums.StatusRefunded
}

func (orders StoreOrders) Money(amountMinor int64) money.Money {
	return money.Money{AmountMinor: amountMinor, Currency: orders.Store.Currency}
}

func (orders StoreOrders) StartOfDay(moment time.Time) time.Time {
	local := moment.In(orders.Location)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, orders.Location)
}

type SalesTotals struct {
	GrossMinor  int64
	FeesMinor   int64
	OrdersCount int
	UnitsSold   int
}

func (orders StoreOrders) SalesBetween(from, until time.Time) SalesTotals {
	totals := SalesTotals{}
	for _, group := range orders.Groups {
		if !IsCountedSale(group) || group.CreatedAt.Before(from) || !group.CreatedAt.Before(until) {
			continue
		}
		totals.GrossMinor += group.SubtotalMinor
		totals.FeesMinor += group.DiscountMinor + group.StoreCreditMinor
		totals.OrdersCount++
		for _, item := range orders.Items[group.ID] {
			totals.UnitsSold += item.Quantity
		}
	}
	return totals
}

func (orders StoreOrders) RefundsBetween(from, until time.Time) (int64, int) {
	total, count := int64(0), 0
	for _, group := range orders.Groups {
		if group.RefundedMinor <= 0 || group.CreatedAt.Before(from) || !group.CreatedAt.Before(until) {
			continue
		}
		total += group.RefundedMinor
		count++
	}
	return total, count
}

func ConversionBasisPoints(orders, visitors int) int {
	if visitors <= 0 {
		return 0
	}
	return min(orders*10_000/visitors, 10_000)
}

func DailyTraffic(ctx context.Context, storeId uuid.UUID, from, until time.Time) (map[string]commerceports.DailyTraffic, error) {
	traffic := map[string]commerceports.DailyTraffic{}
	reader, err := commerceports.Default.StoreInsightsReader()
	if err != nil {
		return traffic, nil
	}
	rows, err := reader.DailyTrafficForStore(ctx, storeId, from, until)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		traffic[row.Day] = row
	}
	return traffic, nil
}

func SumTraffic(traffic map[string]commerceports.DailyTraffic, from, until time.Time) (int, int) {
	views, visitors := 0, 0
	for day := from.UTC(); day.Before(until); day = day.AddDate(0, 0, 1) {
		row := traffic[day.Format(time.DateOnly)]
		views += row.StoreViews
		visitors += row.Visitors
	}
	return views, visitors
}
