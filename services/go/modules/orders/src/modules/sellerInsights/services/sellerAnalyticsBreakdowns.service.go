package services

import (
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/modules/sellerInsights/dtos"
	"nantty/platform/commerceports"
)

type segmentTally struct {
	label   string
	orders  map[uuid.UUID]bool
	units   int
	revenue int64
}

func addToSegment(tallies map[string]*segmentTally, key, label string, group *ent.OrderGroup, item *ent.OrderItem) {
	if key == "" {
		key, label = "unknown", "Unknown"
	}
	entry := tallies[key]
	if entry == nil {
		entry = &segmentTally{label: label, orders: map[uuid.UUID]bool{}}
		tallies[key] = entry
	}
	entry.orders[group.ID] = true
	entry.units += item.Quantity
	entry.revenue += item.LineTotalMinor
}

func (orders StoreOrders) segmentRows(tallies map[string]*segmentTally, total int64) []dtos.SegmentRow {
	rows := make([]dtos.SegmentRow, 0, len(tallies))
	for key, entry := range tallies {
		share := 0
		if total > 0 {
			share = int(entry.revenue * 10_000 / total)
		}
		rows = append(rows, dtos.SegmentRow{Key: key, Label: entry.label, OrdersCount: len(entry.orders), UnitsSold: entry.units, Revenue: orders.Money(entry.revenue), ShareBasisPoints: share})
	}
	sort.SliceStable(rows, func(left, right int) bool { return rows[left].Revenue.AmountMinor > rows[right].Revenue.AmountMinor })
	if len(rows) > 12 {
		rows = rows[:12]
	}
	return rows
}

func (orders StoreOrders) Breakdowns(window AnalyticsRange, cards map[uuid.UUID]commerceports.ProductCard, views map[uuid.UUID]int, stock map[uuid.UUID]int) dtos.AnalyticsBreakdowns {
	categories, states, cities := map[string]*segmentTally{}, map[string]*segmentTally{}, map[string]*segmentTally{}
	hours, weekdays := make([]dtos.TimeSlotRow, 24), make([]dtos.TimeSlotRow, 7)
	for slot := range hours {
		hours[slot] = dtos.TimeSlotRow{Slot: slot, Revenue: orders.Money(0)}
	}
	for slot := range weekdays {
		weekdays[slot] = dtos.TimeSlotRow{Slot: slot, Revenue: orders.Money(0)}
	}
	units, revenue, lastSold := map[uuid.UUID]int{}, map[uuid.UUID]int64{}, map[uuid.UUID]time.Time{}
	total := int64(0)
	breakdowns := dtos.AnalyticsBreakdowns{From: window.From.Format(time.DateOnly), To: window.Until.AddDate(0, 0, -1).Format(time.DateOnly), Refunds: []dtos.RefundRow{}}
	for _, group := range orders.Groups {
		if group.CreatedAt.Before(window.From) || !group.CreatedAt.Before(window.Until) {
			continue
		}
		if group.RefundedMinor > 0 {
			reason := "Refunded"
			if group.CancelReason != nil && *group.CancelReason != "" {
				reason = *group.CancelReason
			}
			breakdowns.Refunds = append(breakdowns.Refunds, dtos.RefundRow{Id: group.ID.String(), OrderId: group.ID.String(), OrderNumber: group.Reference, CustomerName: group.BuyerName,
				Amount: orders.Money(group.RefundedMinor), Reason: reason, RefundedAt: group.UpdatedAt.UTC().Format(time.RFC3339)})
		}
		if !IsCountedSale(group) {
			continue
		}
		local := group.CreatedAt.In(orders.Location)
		hours[local.Hour()].OrdersCount++
		hours[local.Hour()].Revenue.AmountMinor += group.SubtotalMinor
		weekdays[int(local.Weekday())].OrdersCount++
		weekdays[int(local.Weekday())].Revenue.AmountMinor += group.SubtotalMinor
		state := firstText(group.Address.RegionName, group.Address.AdminAreaName)
		city := firstText(group.Address.CityName, group.Address.AdminAreaName)
		for _, item := range orders.Items[group.ID] {
			total += item.LineTotalMinor
			units[item.ProductID] += item.Quantity
			revenue[item.ProductID] += item.LineTotalMinor
			if group.CreatedAt.After(lastSold[item.ProductID]) {
				lastSold[item.ProductID] = group.CreatedAt
			}
			addToSegment(categories, strings.ToLower(item.CategoryName), item.CategoryName, group, item)
			addToSegment(states, strings.ToLower(state), state, group, item)
			cityKey := ""
			if city != "" {
				cityKey = city + "|" + state
			}
			addToSegment(cities, cityKey, strings.TrimSuffix(city+", "+state, ", "), group, item)
		}
	}
	sort.Slice(breakdowns.Refunds, func(left, right int) bool {
		return breakdowns.Refunds[left].RefundedAt > breakdowns.Refunds[right].RefundedAt
	})
	breakdowns.ByCategory, breakdowns.ByState, breakdowns.ByCity = orders.segmentRows(categories, total), orders.segmentRows(states, total), orders.segmentRows(cities, total)
	breakdowns.ByHourOfDay, breakdowns.ByWeekday = hours, weekdays
	breakdowns.BestProducts, breakdowns.SlowProducts = orders.productPerformance(cards, units, revenue, lastSold, views, stock)
	return breakdowns
}

func (orders StoreOrders) productPerformance(cards map[uuid.UUID]commerceports.ProductCard, units map[uuid.UUID]int, revenue map[uuid.UUID]int64, lastSold map[uuid.UUID]time.Time, views, stock map[uuid.UUID]int) ([]dtos.ProductPerformance, []dtos.ProductPerformance) {
	all := make([]dtos.ProductPerformance, 0, len(cards))
	for productId, card := range cards {
		if !card.Active {
			continue
		}
		performance := dtos.ProductPerformance{ProductId: productId.String(), Name: card.Name, ImageUrl: optional(card.ImageUrl), CategoryName: card.CategoryName, UnitsSold: units[productId],
			Revenue: orders.Money(revenue[productId]), ProductViews: views[productId], StockAvailable: stock[productId], ConversionRateBasisPoints: ConversionBasisPoints(units[productId], views[productId])}
		if sold, found := lastSold[productId]; found {
			performance.LastSoldAt = optional(sold.In(orders.Location).Format(time.DateOnly))
		}
		all = append(all, performance)
	}
	best := []dtos.ProductPerformance{}
	for _, performance := range all {
		if performance.UnitsSold > 0 {
			best = append(best, performance)
		}
	}
	sort.SliceStable(best, func(left, right int) bool { return best[left].Revenue.AmountMinor > best[right].Revenue.AmountMinor })
	slow := append([]dtos.ProductPerformance{}, all...)
	sort.SliceStable(slow, func(left, right int) bool {
		if slow[left].UnitsSold != slow[right].UnitsSold {
			return slow[left].UnitsSold < slow[right].UnitsSold
		}
		return slow[left].StockAvailable > slow[right].StockAvailable
	})
	return firstProducts(best, 10), firstProducts(slow, 10)
}

func firstProducts(products []dtos.ProductPerformance, limit int) []dtos.ProductPerformance {
	if len(products) > limit {
		return products[:limit]
	}
	return products
}

func firstText(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
