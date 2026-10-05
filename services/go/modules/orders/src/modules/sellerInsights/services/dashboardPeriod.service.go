package services

import (
	"time"

	"zudomart/modules/orders/src/modules/sellerInsights/dtos"
)

var DashboardPeriods = []string{"live", "today", "yesterday", "week", "month", "all"}

type periodBucket struct {
	label        string
	from, before time.Time
}

func (orders StoreOrders) periodBuckets(period string) []periodBucket {
	today := orders.StartOfDay(orders.Now)
	hourly := func(start time.Time, hours int) []periodBucket {
		buckets := make([]periodBucket, 0, hours)
		for offset := 0; offset < hours; offset++ {
			from := start.Add(time.Duration(offset) * time.Hour)
			buckets = append(buckets, periodBucket{label: from.In(orders.Location).Format("15:00"), from: from, before: from.Add(time.Hour)})
		}
		return buckets
	}
	daily := func(days int) []periodBucket {
		buckets := make([]periodBucket, 0, days)
		for offset := days - 1; offset >= 0; offset-- {
			from := today.AddDate(0, 0, -offset)
			buckets = append(buckets, periodBucket{label: from.Format(time.DateOnly), from: from, before: from.AddDate(0, 0, 1)})
		}
		return buckets
	}
	switch period {
	case "live":
		return hourly(orders.Now.Truncate(time.Hour).Add(-23*time.Hour), 24)
	case "today":
		return hourly(today, 24)
	case "yesterday":
		return hourly(today.AddDate(0, 0, -1), 24)
	case "week":
		return daily(7)
	case "all":
		buckets := make([]periodBucket, 0, 12)
		month := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, orders.Location)
		for offset := 11; offset >= 0; offset-- {
			from := month.AddDate(0, -offset, 0)
			buckets = append(buckets, periodBucket{label: from.Format("2006-01"), from: from, before: from.AddDate(0, 1, 0)})
		}
		buckets[0].from = time.Time{}
		return buckets
	}
	return daily(30)
}

func (orders StoreOrders) PeriodSummary(period string) (string, dtos.PeriodTotals) {
	if period == "" {
		period = "month"
	}
	buckets := orders.periodBuckets(period)
	totals := dtos.PeriodTotals{Series: make([]dtos.PeriodPoint, 0, len(buckets))}
	for _, bucket := range buckets {
		sales := orders.SalesBetween(bucket.from, bucket.before)
		totals.Series = append(totals.Series, dtos.PeriodPoint{Label: bucket.label, Value: sales.GrossMinor})
		totals.TotalSales.AmountMinor += sales.GrossMinor
		totals.Orders += sales.OrdersCount
	}
	totals.TotalSales.Currency = orders.Store.Currency
	return period, totals
}
