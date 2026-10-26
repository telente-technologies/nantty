package services

import (
	"sort"

	"github.com/google/uuid"

	"nantty/modules/orders/src/enums"
)

func salesByCategory(data ReportData) ReportResult {
	result := data.base("sales-by-category", "Sales by category", []ReportColumn{{"group", "Category", "text"}, {"orders", "Orders", "number"}, {"units", "Units", "number"}, {"revenue", "Revenue", "money"}, {"share", "Share", "percent"}})
	type entry struct {
		orders  map[uuid.UUID]bool
		units   int
		revenue int64
	}
	byCategory := map[string]*entry{}
	var total int64
	for _, group := range data.Groups {
		if !isSale(group) {
			continue
		}
		for _, item := range data.Items[group.ID] {
			name := item.CategoryName
			if name == "" {
				name = "Uncategorised"
			}
			if byCategory[name] == nil {
				byCategory[name] = &entry{orders: map[uuid.UUID]bool{}}
			}
			byCategory[name].orders[group.ID] = true
			byCategory[name].units += item.Quantity
			byCategory[name].revenue += item.LineTotalMinor
			total += item.LineTotalMinor
		}
	}
	names := make([]string, 0, len(byCategory))
	for name := range byCategory {
		names = append(names, name)
	}
	sort.Slice(names, func(left, right int) bool {
		if byCategory[names[left]].revenue != byCategory[names[right]].revenue {
			return byCategory[names[left]].revenue > byCategory[names[right]].revenue
		}
		return names[left] < names[right]
	})
	for _, name := range names {
		item := byCategory[name]
		share := int64(0)
		if total > 0 {
			share = item.revenue * 10_000 / total
		}
		result.Rows = append(result.Rows, map[string]any{"group": name, "orders": len(item.orders), "units": item.units, "revenue": data.money(item.revenue), "share": share})
	}
	return result
}

func ordersByStatus(data ReportData) ReportResult {
	result := data.base("orders-by-status", "Orders by status", []ReportColumn{{"status", "Status", "text"}, {"orders", "Orders", "number"}, {"value", "Value", "money"}, {"share", "Share", "percent"}})
	counts, values := map[string]int{}, map[string]int64{}
	totalOrders := 0
	for _, group := range data.Groups {
		if group.PaymentStatus == enums.PaymentPending {
			continue
		}
		counts[group.Status]++
		values[group.Status] += group.TotalMinor
		totalOrders++
	}
	for _, status := range enums.SellerStatuses {
		share := int64(0)
		if totalOrders > 0 {
			share = int64(counts[status]) * 10_000 / int64(totalOrders)
		}
		result.Rows = append(result.Rows, map[string]any{"status": status, "orders": counts[status], "value": data.money(values[status]), "share": share})
	}
	return result
}

func topCustomers(data ReportData) ReportResult {
	result := data.base("top-customers", "Top customers", []ReportColumn{{"customer", "Customer", "text"}, {"username", "Username", "text"}, {"state", "State", "text"}, {"orders", "Orders", "number"}, {"spent", "Spent", "money"}, {"averageOrder", "Average order", "money"}, {"lastOrder", "Last order", "date"}})
	type entry struct {
		name, username, state string
		orders                int
		spent                 int64
		last                  string
	}
	byBuyer := map[uuid.UUID]*entry{}
	for _, group := range data.Groups {
		if !isSale(group) {
			continue
		}
		row := byBuyer[group.BuyerAccountID]
		if row == nil {
			row = &entry{}
			byBuyer[group.BuyerAccountID] = row
		}
		row.name, row.username, row.state = group.BuyerName, group.BuyerUsername, group.Address.RegionName
		row.orders++
		row.spent += group.SubtotalMinor
		if day := group.CreatedAt.UTC().Format("2006-01-02"); day > row.last {
			row.last = day
		}
	}
	ranked := make([]*entry, 0, len(byBuyer))
	for _, row := range byBuyer {
		ranked = append(ranked, row)
	}
	sort.Slice(ranked, func(left, right int) bool {
		if ranked[left].spent != ranked[right].spent {
			return ranked[left].spent > ranked[right].spent
		}
		return ranked[left].name < ranked[right].name
	})
	if len(ranked) > 50 {
		ranked = ranked[:50]
	}
	for _, row := range ranked {
		result.Rows = append(result.Rows, map[string]any{"customer": row.name, "username": row.username, "state": row.state, "orders": row.orders, "spent": data.money(row.spent),
			"averageOrder": data.money(row.spent / int64(row.orders)), "lastOrder": row.last})
	}
	return result
}
