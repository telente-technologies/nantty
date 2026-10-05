package services

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/databases/schema"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/platform/commerceports"
)

func fixtureOrders(now time.Time) StoreOrders {
	lagos, _ := time.LoadLocation("Africa/Lagos")
	buyer, product := uuid.New(), uuid.New()
	group := func(daysAgo int, hour int, status string, subtotal int64, state string) *ent.OrderGroup {
		day := now.In(lagos).AddDate(0, 0, -daysAgo)
		created := time.Date(day.Year(), day.Month(), day.Day(), hour, 0, 0, 0, lagos)
		return &ent.OrderGroup{ID: uuid.New(), CreatedAt: created, UpdatedAt: created, Status: status, PaymentStatus: "paid", BuyerAccountID: buyer, BuyerName: "Kemi", Reference: "ZM-1",
			SubtotalMinor: subtotal, TotalMinor: subtotal, DiscountMinor: subtotal / 10, Address: schema.AddressSnapshot{RegionName: state, CityName: "Ikeja"}}
	}
	groups := []*ent.OrderGroup{group(40, 10, "completed", 100_000, "Lagos"), group(3, 14, "delivered", 200_000, "Lagos"), group(0, 9, "new", 50_000, "Oyo"), group(0, 11, "cancelled", 999_999, "Lagos")}
	items := map[uuid.UUID][]*ent.OrderItem{}
	for _, row := range groups {
		items[row.ID] = []*ent.OrderItem{{ProductID: product, ProductName: "Adire scarf", Quantity: 2, LineTotalMinor: row.SubtotalMinor, CategoryName: "Fashion"}}
	}
	return StoreOrders{Store: commerceports.StoreAccess{Currency: "NGN"}, Location: lagos, Now: now, Groups: groups, Items: items}
}

func TestDashboardSalesExcludeCancelledOrdersAndCompareWithThePreviousPeriod(t *testing.T) {
	now := time.Date(2026, 10, 5, 15, 0, 0, 0, time.UTC)
	orders := fixtureOrders(now)
	today, week, month, lifetime := orders.SalesSummaries()
	if today.Current.AmountMinor != 50_000 || today.OrdersCount != 1 {
		t.Fatalf("today: %+v", today)
	}
	if week.Current.AmountMinor != 250_000 || month.Current.AmountMinor != 250_000 || month.Previous.AmountMinor != 100_000 {
		t.Fatalf("week %+v month %+v", week, month)
	}
	if lifetime.Total.AmountMinor != 350_000 || lifetime.OrdersCount != 3 {
		t.Fatalf("lifetime: %+v", lifetime)
	}
	if points := orders.DailyRevenue(30); len(points) != 30 || points[29].Revenue.AmountMinor != 50_000 {
		t.Fatalf("daily revenue: %+v", points[29])
	}
	alerts := orders.Alerts(0, 2, commerceports.StockAlertSummary{OutOfStockCount: 1})
	if len(alerts) != 3 || alerts[0].Kind != "orders_to_accept" || alerts[1].Title != "2 disputes need your reply" {
		t.Fatalf("alerts: %+v", alerts)
	}
	growth := orders.CustomerGrowth(30)
	if growth.TotalCustomers != 1 || growth.NewCustomers != 0 || growth.ReturningCustomers != 1 {
		t.Fatalf("growth: %+v", growth)
	}
}

func TestAnalyticsBucketsAndBreakdowns(t *testing.T) {
	now := time.Date(2026, 10, 5, 15, 0, 0, 0, time.UTC)
	orders := fixtureOrders(now)
	today := orders.StartOfDay(now)
	oneDay := orders.Overview(AnalyticsRange{From: today, Until: today.AddDate(0, 0, 1), RequestedFrom: today}, nil)
	if oneDay.Bucket != "hour" || len(oneDay.Series) != 24 || oneDay.Series[9].OrdersCount != 1 {
		t.Fatalf("hourly: %s %d", oneDay.Bucket, len(oneDay.Series))
	}
	month := orders.Overview(AnalyticsRange{From: today.AddDate(0, 0, -29), Until: today.AddDate(0, 0, 1), RequestedFrom: today.AddDate(0, 0, -29)}, nil)
	if month.Bucket != "day" || len(month.Series) != 30 || month.GrossSales.AmountMinor != 250_000 || month.NetSales.AmountMinor != 225_000 || month.Previous.GrossSales.AmountMinor != 100_000 {
		t.Fatalf("monthly: %+v", month.ComparableTotals)
	}
	if BucketFor(90) != "week" || BucketFor(400) != "month" {
		t.Fatal("bucket rules drifted from the contract")
	}
	breakdowns := orders.Breakdowns(AnalyticsRange{From: today.AddDate(0, 0, -29), Until: today.AddDate(0, 0, 1)}, nil, nil, nil)
	if len(breakdowns.ByState) != 2 || breakdowns.ByState[0].Label != "Lagos" || breakdowns.ByState[0].ShareBasisPoints != 8000 || len(breakdowns.ByHourOfDay) != 24 || breakdowns.ByHourOfDay[14].OrdersCount != 1 {
		t.Fatalf("breakdowns: %+v %+v", breakdowns.ByState, breakdowns.ByHourOfDay[14])
	}
}
