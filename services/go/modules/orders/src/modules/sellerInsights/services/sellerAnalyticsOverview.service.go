package services

import (
	"time"

	"zudomart/modules/orders/src/modules/sellerInsights/dtos"
	"zudomart/platform/commerceports"
)

type AnalyticsRange struct {
	From          time.Time
	Until         time.Time
	RequestedFrom time.Time
	LimitedToDays *int
}

func (orders StoreOrders) comparableTotals(from, until time.Time, traffic map[string]commerceports.DailyTraffic) dtos.ComparableTotals {
	sales := orders.SalesBetween(from, until)
	refunds, _ := orders.RefundsBetween(from, until)
	_, visitors := SumTraffic(traffic, from, until)
	average := int64(0)
	if sales.OrdersCount > 0 {
		average = (sales.GrossMinor + int64(sales.OrdersCount)/2) / int64(sales.OrdersCount)
	}
	return dtos.ComparableTotals{GrossSales: orders.Money(sales.GrossMinor), NetSales: orders.Money(sales.GrossMinor - refunds - sales.FeesMinor), OrdersCount: sales.OrdersCount,
		AverageOrderValue: orders.Money(average), ConversionRateBasisPoints: ConversionBasisPoints(sales.OrdersCount, visitors)}
}

func BucketFor(days int) string {
	switch {
	case days == 1:
		return "hour"
	case days <= 62:
		return "day"
	case days <= 200:
		return "week"
	}
	return "month"
}

func (orders StoreOrders) bucketStarts(bucket string, from, until time.Time) []time.Time {
	starts := []time.Time{from}
	for {
		last := starts[len(starts)-1]
		var next time.Time
		switch bucket {
		case "hour":
			next = last.Add(time.Hour)
		case "day":
			next = last.AddDate(0, 0, 1)
		case "week":
			next = last.AddDate(0, 0, 1)
			for next.Weekday() != time.Monday {
				next = next.AddDate(0, 0, 1)
			}
		default:
			next = time.Date(last.Year(), last.Month()+1, 1, 0, 0, 0, 0, orders.Location)
		}
		if !next.Before(until) {
			return starts
		}
		starts = append(starts, next)
	}
}

func (orders StoreOrders) Overview(window AnalyticsRange, traffic map[string]commerceports.DailyTraffic) dtos.AnalyticsOverview {
	days := int(window.Until.Sub(window.From).Hours()/24 + 0.5)
	previousFrom := window.From.AddDate(0, 0, -days)
	sales := orders.SalesBetween(window.From, window.Until)
	refunds, refundedOrders := orders.RefundsBetween(window.From, window.Until)
	views, visitors := SumTraffic(traffic, window.From, window.Until)
	overview := dtos.AnalyticsOverview{
		ComparableTotals: orders.comparableTotals(window.From, window.Until, traffic), From: window.From.Format(time.DateOnly), To: window.Until.AddDate(0, 0, -1).Format(time.DateOnly),
		RequestedFrom: window.RequestedFrom.Format(time.DateOnly), HistoryLimitedToDays: window.LimitedToDays, Refunds: orders.Money(refunds), Fees: orders.Money(sales.FeesMinor),
		RefundedOrdersCount: refundedOrders, UnitsSold: sales.UnitsSold, StoreViews: views, Visitors: visitors, Previous: orders.comparableTotals(previousFrom, window.From, traffic),
		Bucket: BucketFor(days), Series: []dtos.SeriesPoint{},
	}
	starts := orders.bucketStarts(overview.Bucket, window.From, window.Until)
	for index, start := range starts {
		end := window.Until
		if index+1 < len(starts) {
			end = starts[index+1]
		}
		point := orders.comparableTotals(start, end, traffic)
		label := start.Format(time.DateOnly)
		if overview.Bucket == "hour" {
			label = start.Format("2006-01-02T15:00")
		}
		bucketViews := 0
		if overview.Bucket != "hour" {
			bucketViews, _ = SumTraffic(traffic, start, end)
		}
		overview.Series = append(overview.Series, dtos.SeriesPoint{PeriodStart: label, GrossSales: point.GrossSales, NetSales: point.NetSales, OrdersCount: point.OrdersCount, StoreViews: bucketViews})
	}
	return overview
}
