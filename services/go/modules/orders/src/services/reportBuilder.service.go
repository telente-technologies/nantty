package services

import (
	"sort"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/enums"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/platform/commerceports"
	"zudomart/platform/money"
)

type ReportColumn struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Kind  string `json:"kind"`
}

type ReportResult struct {
	ReportKind  string           `json:"reportKind"`
	Title       string           `json:"title"`
	From        string           `json:"from"`
	To          string           `json:"to"`
	Columns     []ReportColumn   `json:"columns"`
	Rows        []map[string]any `json:"rows"`
	Totals      map[string]any   `json:"totals"`
	GeneratedAt time.Time        `json:"generatedAt"`
}

type ReportData struct {
	Currency     money.CurrencyCode
	From         time.Time
	To           time.Time
	Groups       []*ent.OrderGroup
	Items        map[uuid.UUID][]*ent.OrderItem
	Now          time.Time
	FirstOrderAt map[uuid.UUID]time.Time
	Tax          *commerceports.StoreTaxSettings
}

var OrderReportKinds = []string{"sales-by-day", "sales-by-product", "sales-by-category", "sales-by-location", "tax", "orders-by-status", "order-fulfilment-time",
	"customers-new-vs-returning", "top-customers", "best-sellers"}

var SourcedReportKinds = []string{"inventory-valuation", "low-stock", "slow-sellers", "settlements", "fees", "refunds", "payouts", "ads-campaigns"}

var ReportKinds = append(append([]string{}, OrderReportKinds...), SourcedReportKinds...)

var LocationReportKinds = []string{"sales-by-day", "sales-by-product", "sales-by-category", "inventory-valuation", "low-stock"}

func isSale(group *ent.OrderGroup) bool {
	switch group.Status {
	case enums.StatusCancelled, enums.StatusRefunded, enums.StatusReturned, enums.StatusPending:
		return false
	}
	return true
}

func (data ReportData) money(amountMinor int64) money.Money {
	return money.Money{AmountMinor: amountMinor, Currency: data.Currency}
}

func (data ReportData) base(kind, title string, columns []ReportColumn) ReportResult {
	return ReportResult{ReportKind: kind, Title: title, From: data.From.Format("2006-01-02"), To: data.To.Format("2006-01-02"), Columns: columns, Rows: []map[string]any{}, GeneratedAt: data.Now}
}

func BuildReport(kind string, data ReportData) (ReportResult, bool) {
	switch kind {
	case "sales-by-day":
		return salesByDay(data), true
	case "sales-by-product":
		return salesByProduct(data, "sales-by-product", "Sales by product", false, 0), true
	case "best-sellers":
		return salesByProduct(data, "best-sellers", "Best sellers", true, 25), true
	case "sales-by-category":
		return salesByCategory(data), true
	case "orders-by-status":
		return ordersByStatus(data), true
	case "top-customers":
		return topCustomers(data), true
	case "sales-by-location":
		return salesByLocation(data), true
	case "tax":
		return taxReport(data), true
	case "order-fulfilment-time":
		return orderFulfilmentTime(data), true
	case "customers-new-vs-returning":
		return customersNewVsReturning(data), true
	}
	return ReportResult{}, false
}

func salesByDay(data ReportData) ReportResult {
	result := data.base("sales-by-day", "Sales by day", []ReportColumn{{"date", "Date", "date"}, {"orders", "Orders", "number"}, {"items", "Items", "number"}, {"averageOrder", "Average order", "money"}, {"revenue", "Revenue", "money"}})
	type bucket struct {
		orders, items int
		revenue       int64
	}
	buckets := map[string]*bucket{}
	for _, group := range data.Groups {
		if !isSale(group) {
			continue
		}
		key := group.CreatedAt.UTC().Format("2006-01-02")
		if buckets[key] == nil {
			buckets[key] = &bucket{}
		}
		buckets[key].orders++
		buckets[key].revenue += group.SubtotalMinor
		for _, item := range data.Items[group.ID] {
			buckets[key].items += item.Quantity
		}
	}
	var totalOrders, totalItems int
	var totalRevenue int64
	for day := data.From; !day.After(data.To); day = day.AddDate(0, 0, 1) {
		entry := buckets[day.Format("2006-01-02")]
		if entry == nil {
			entry = &bucket{}
		}
		average := int64(0)
		if entry.orders > 0 {
			average = entry.revenue / int64(entry.orders)
		}
		result.Rows = append(result.Rows, map[string]any{"date": day.Format("2006-01-02"), "orders": entry.orders, "items": entry.items, "averageOrder": data.money(average), "revenue": data.money(entry.revenue)})
		totalOrders, totalItems, totalRevenue = totalOrders+entry.orders, totalItems+entry.items, totalRevenue+entry.revenue
	}
	result.Totals = map[string]any{"date": "Total", "orders": totalOrders, "items": totalItems, "revenue": data.money(totalRevenue)}
	return result
}

type productTotals struct {
	name, category string
	units, orders  int
	revenue, cost  int64
}

func salesByProduct(data ReportData, kind, title string, rankByUnits bool, limit int) ReportResult {
	columns := []ReportColumn{{"product", "Product", "text"}, {"category", "Category", "text"}, {"units", "Units", "number"}, {"revenue", "Revenue", "money"}}
	if !rankByUnits {
		columns = append(columns, ReportColumn{"cost", "Cost", "money"}, ReportColumn{"grossProfit", "Gross profit", "money"}, ReportColumn{"margin", "Margin", "percent"})
	} else {
		columns = append([]ReportColumn{{"rank", "Rank", "number"}}, append(columns[:3:3], ReportColumn{"orders", "Orders", "number"}, ReportColumn{"revenue", "Revenue", "money"})...)
	}
	result := data.base(kind, title, columns)
	totals := map[uuid.UUID]*productTotals{}
	for _, group := range data.Groups {
		if !isSale(group) {
			continue
		}
		for _, item := range data.Items[group.ID] {
			entry := totals[item.ProductID]
			if entry == nil {
				entry = &productTotals{name: item.ProductName, category: item.CategoryName}
				totals[item.ProductID] = entry
			}
			entry.units += item.Quantity
			entry.orders++
			entry.revenue += item.LineTotalMinor
			if item.CostPriceMinor != nil {
				entry.cost += *item.CostPriceMinor * int64(item.Quantity)
			}
		}
	}
	ranked := make([]*productTotals, 0, len(totals))
	for _, entry := range totals {
		ranked = append(ranked, entry)
	}
	sort.Slice(ranked, func(left, right int) bool {
		if rankByUnits && ranked[left].units != ranked[right].units {
			return ranked[left].units > ranked[right].units
		}
		if ranked[left].revenue != ranked[right].revenue {
			return ranked[left].revenue > ranked[right].revenue
		}
		return ranked[left].name < ranked[right].name
	})
	if limit > 0 && len(ranked) > limit {
		ranked = ranked[:limit]
	}
	for position, entry := range ranked {
		row := map[string]any{"product": entry.name, "category": entry.category, "units": entry.units, "orders": entry.orders, "revenue": data.money(entry.revenue), "rank": position + 1}
		if !rankByUnits {
			profit := entry.revenue - entry.cost
			margin := int64(0)
			if entry.revenue > 0 {
				margin = profit * 10_000 / entry.revenue
			}
			row["cost"], row["grossProfit"], row["margin"] = data.money(entry.cost), data.money(profit), margin
		}
		result.Rows = append(result.Rows, row)
	}
	return result
}
