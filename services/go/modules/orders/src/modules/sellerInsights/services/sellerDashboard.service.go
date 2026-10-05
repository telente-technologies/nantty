package services

import (
	"sort"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/enums"
	"zudomart/modules/orders/src/modules/sellerInsights/dtos"
	"zudomart/platform/commerceports"
)

func (orders StoreOrders) periodSales(label string, days int) dtos.PeriodSales {
	end := orders.StartOfDay(orders.Now).AddDate(0, 0, 1)
	start := end.AddDate(0, 0, -days)
	current, previous := orders.SalesBetween(start, end), orders.SalesBetween(start.AddDate(0, 0, -days), start)
	return dtos.PeriodSales{Label: label, Current: orders.Money(current.GrossMinor), Previous: orders.Money(previous.GrossMinor), OrdersCount: current.OrdersCount}
}

func (orders StoreOrders) SalesSummaries() (dtos.PeriodSales, dtos.PeriodSales, dtos.PeriodSales, dtos.LifetimeSales) {
	lifetime := orders.SalesBetween(time.Time{}, orders.Now.Add(time.Hour))
	return orders.periodSales("Today", 1), orders.periodSales("Last 7 days", 7), orders.periodSales("Last 30 days", 30),
		dtos.LifetimeSales{Total: orders.Money(lifetime.GrossMinor), OrdersCount: lifetime.OrdersCount}
}

func (orders StoreOrders) StatusCounts() []dtos.StatusCount {
	counts := map[string]int{}
	for _, group := range orders.Groups {
		counts[group.Status]++
	}
	result := make([]dtos.StatusCount, 0, len(enums.SellerStatuses))
	for _, status := range enums.SellerStatuses {
		result = append(result, dtos.StatusCount{Status: status, Count: counts[status]})
	}
	return result
}

func (orders StoreOrders) DailyRevenue(days int) []dtos.DailyRevenuePoint {
	start := orders.StartOfDay(orders.Now).AddDate(0, 0, -(days - 1))
	points := make([]dtos.DailyRevenuePoint, 0, days)
	for offset := 0; offset < days; offset++ {
		day := start.AddDate(0, 0, offset)
		totals := orders.SalesBetween(day, day.AddDate(0, 0, 1))
		points = append(points, dtos.DailyRevenuePoint{Date: day.Format(time.DateOnly), Revenue: orders.Money(totals.GrossMinor), OrdersCount: totals.OrdersCount})
	}
	return points
}

func (orders StoreOrders) TopProducts(since time.Time, limit int) []dtos.TopProduct {
	type tally struct {
		name     string
		image    *string
		units    int
		revenue  int64
		lastSale time.Time
	}
	byProduct := map[uuid.UUID]*tally{}
	for _, group := range orders.Groups {
		if !IsCountedSale(group) || group.CreatedAt.Before(since) {
			continue
		}
		for _, item := range orders.Items[group.ID] {
			entry := byProduct[item.ProductID]
			if entry == nil {
				entry = &tally{name: item.ProductName, image: item.ImageURL}
				byProduct[item.ProductID] = entry
			}
			entry.units += item.Quantity
			entry.revenue += item.LineTotalMinor
		}
	}
	products := make([]dtos.TopProduct, 0, len(byProduct))
	for productId, entry := range byProduct {
		products = append(products, dtos.TopProduct{ProductId: productId.String(), Name: entry.name, ImageUrl: entry.image, UnitsSold: entry.units, Revenue: orders.Money(entry.revenue)})
	}
	sort.SliceStable(products, func(left, right int) bool {
		return products[left].Revenue.AmountMinor > products[right].Revenue.AmountMinor
	})
	if len(products) > limit {
		products = products[:limit]
	}
	return products
}

func LowStockAlertsOf(summary commerceports.StockAlertSummary) []dtos.LowStockAlert {
	alerts := make([]dtos.LowStockAlert, 0, len(summary.Rows))
	for _, row := range summary.Rows {
		alerts = append(alerts, dtos.LowStockAlert{VariantId: row.VariantId.String(), ProductId: row.ProductId.String(), ProductName: row.ProductName, VariantTitle: row.VariantTitle,
			Sku: row.Sku, LocationId: row.LocationId.String(), Available: row.Available, LowStockThreshold: row.LowStockLevel})
	}
	return alerts
}

func (orders StoreOrders) CustomerGrowth(days int) dtos.CustomerGrowth {
	firstOrder, orderCount, lastOrder := map[uuid.UUID]time.Time{}, map[uuid.UUID]int{}, map[uuid.UUID]time.Time{}
	for _, group := range orders.Groups {
		if !IsCountedSale(group) {
			continue
		}
		if first, seen := firstOrder[group.BuyerAccountID]; !seen || group.CreatedAt.Before(first) {
			firstOrder[group.BuyerAccountID] = group.CreatedAt
		}
		if group.CreatedAt.After(lastOrder[group.BuyerAccountID]) {
			lastOrder[group.BuyerAccountID] = group.CreatedAt
		}
		orderCount[group.BuyerAccountID]++
	}
	start := orders.StartOfDay(orders.Now).AddDate(0, 0, -(days - 1))
	previousStart := start.AddDate(0, 0, -days)
	growth := dtos.CustomerGrowth{TotalCustomers: len(firstOrder), DailyNewCustomers: make([]int, days)}
	for buyer, first := range firstOrder {
		switch {
		case !first.Before(start):
			growth.NewCustomers++
			growth.DailyNewCustomers[min(int(first.Sub(start).Hours()/24), days-1)]++
		case !first.Before(previousStart):
			growth.PreviousNewCustomers++
		}
		if orderCount[buyer] > 1 && !lastOrder[buyer].Before(start) {
			growth.ReturningCustomers++
		}
	}
	return growth
}

func (orders StoreOrders) RecentOrders(limit int) []dtos.RecentOrder {
	recent := []dtos.RecentOrder{}
	for index := len(orders.Groups) - 1; index >= 0 && len(recent) < limit; index-- {
		group := orders.Groups[index]
		items := 0
		for _, item := range orders.Items[group.ID] {
			items += item.Quantity
		}
		recent = append(recent, dtos.RecentOrder{Id: group.ID.String(), OrderNumber: group.Reference, CustomerName: group.BuyerName, CustomerUsername: group.BuyerUsername,
			ItemsCount: items, Total: orders.Money(group.TotalMinor), Status: group.Status, CreatedAt: group.CreatedAt.UTC().Format(time.RFC3339)})
	}
	return recent
}
