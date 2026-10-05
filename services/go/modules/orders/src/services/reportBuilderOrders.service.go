package services

import (
	"math"
	"sort"
	"time"

	"github.com/google/uuid"
)

func weekStart(moment time.Time) time.Time {
	day := moment.UTC().Truncate(24 * time.Hour)
	offset := (int(day.Weekday()) + 6) % 7
	return day.AddDate(0, 0, -offset)
}

func (data ReportData) weeks() []time.Time {
	weeks := []time.Time{}
	for week := weekStart(data.From); !week.After(data.To); week = week.AddDate(0, 0, 7) {
		weeks = append(weeks, week)
	}
	return weeks
}

func basisPoints(part, whole int64) int64 {
	if whole <= 0 {
		return 0
	}
	return part * 10_000 / whole
}

func roundedHours(total time.Duration, count int) any {
	if count == 0 {
		return nil
	}
	return math.Round(total.Hours()/float64(count)*10) / 10
}

func salesByLocation(data ReportData) ReportResult {
	result := data.base("sales-by-location", "Sales by location", []ReportColumn{{"group", "State", "text"}, {"orders", "Orders", "number"}, {"units", "Units", "number"}, {"revenue", "Revenue", "money"}, {"share", "Share", "percent"}})
	type entry struct {
		orders, units int
		revenue       int64
	}
	byState := map[string]*entry{}
	var total int64
	for _, group := range data.Groups {
		if !isSale(group) {
			continue
		}
		state := group.Address.RegionName
		if state == "" {
			state = "Unknown"
		}
		if byState[state] == nil {
			byState[state] = &entry{}
		}
		byState[state].orders++
		for _, item := range data.Items[group.ID] {
			byState[state].units += item.Quantity
			byState[state].revenue += item.LineTotalMinor
			total += item.LineTotalMinor
		}
	}
	states := make([]string, 0, len(byState))
	for state := range byState {
		states = append(states, state)
	}
	sort.Slice(states, func(left, right int) bool {
		if byState[states[left]].revenue != byState[states[right]].revenue {
			return byState[states[left]].revenue > byState[states[right]].revenue
		}
		return states[left] < states[right]
	})
	for _, state := range states {
		entry := byState[state]
		result.Rows = append(result.Rows, map[string]any{"group": state, "orders": entry.orders, "units": entry.units, "revenue": data.money(entry.revenue), "share": basisPoints(entry.revenue, total)})
	}
	return result
}

func orderFulfilmentTime(data ReportData) ReportResult {
	result := data.base("order-fulfilment-time", "Fulfilment time", []ReportColumn{{"week", "Week of", "date"}, {"shipped", "Shipped", "number"},
		{"averageHoursToShip", "Avg hours to ship", "number"}, {"averageHoursToDeliver", "Avg hours to deliver", "number"}, {"shippedWithin48Hours", "Shipped within 48h", "percent"}})
	type entry struct {
		shipped, delivered, fast int
		toShip, toDeliver        time.Duration
	}
	byWeek := map[time.Time]*entry{}
	for _, group := range data.Groups {
		if group.ShippedAt == nil {
			continue
		}
		week := weekStart(*group.ShippedAt)
		if byWeek[week] == nil {
			byWeek[week] = &entry{}
		}
		row := byWeek[week]
		toShip := group.ShippedAt.Sub(group.CreatedAt)
		row.shipped++
		row.toShip += toShip
		if toShip <= 48*time.Hour {
			row.fast++
		}
		if group.DeliveredAt != nil {
			row.delivered++
			row.toDeliver += group.DeliveredAt.Sub(*group.ShippedAt)
		}
	}
	for _, week := range data.weeks() {
		row := byWeek[week]
		if row == nil {
			row = &entry{}
		}
		result.Rows = append(result.Rows, map[string]any{"week": week.Format(time.DateOnly), "shipped": row.shipped, "averageHoursToShip": roundedHours(row.toShip, row.shipped),
			"averageHoursToDeliver": roundedHours(row.toDeliver, row.delivered), "shippedWithin48Hours": basisPoints(int64(row.fast), int64(row.shipped))})
	}
	return result
}

func customersNewVsReturning(data ReportData) ReportResult {
	result := data.base("customers-new-vs-returning", "New vs returning customers", []ReportColumn{{"week", "Week of", "date"}, {"customers", "Customers", "number"},
		{"newCustomers", "New", "number"}, {"returningCustomers", "Returning", "number"}, {"newRevenue", "New revenue", "money"}, {"returningRevenue", "Returning revenue", "money"},
		{"returningShare", "Returning share", "percent"}})
	type entry struct {
		buyers, newBuyers            map[uuid.UUID]bool
		newRevenue, returningRevenue int64
	}
	byWeek := map[time.Time]*entry{}
	for _, group := range data.Groups {
		if !isSale(group) {
			continue
		}
		week := weekStart(group.CreatedAt)
		if byWeek[week] == nil {
			byWeek[week] = &entry{buyers: map[uuid.UUID]bool{}, newBuyers: map[uuid.UUID]bool{}}
		}
		row := byWeek[week]
		row.buyers[group.BuyerAccountID] = true
		first, known := data.FirstOrderAt[group.BuyerAccountID]
		if !known || !weekStart(first).Before(week) {
			row.newBuyers[group.BuyerAccountID] = true
			row.newRevenue += group.SubtotalMinor
		} else {
			row.returningRevenue += group.SubtotalMinor
		}
	}
	for _, week := range data.weeks() {
		row := byWeek[week]
		if row == nil {
			row = &entry{buyers: map[uuid.UUID]bool{}, newBuyers: map[uuid.UUID]bool{}}
		}
		result.Rows = append(result.Rows, map[string]any{"week": week.Format(time.DateOnly), "customers": len(row.buyers), "newCustomers": len(row.newBuyers),
			"returningCustomers": len(row.buyers) - len(row.newBuyers), "newRevenue": data.money(row.newRevenue), "returningRevenue": data.money(row.returningRevenue),
			"returningShare": basisPoints(row.returningRevenue, row.newRevenue+row.returningRevenue)})
	}
	return result
}
