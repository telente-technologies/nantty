package dtos

import "nantty/platform/money"

type ComparableTotals struct {
	GrossSales                money.Money `json:"grossSales"`
	NetSales                  money.Money `json:"netSales"`
	OrdersCount               int         `json:"ordersCount"`
	AverageOrderValue         money.Money `json:"averageOrderValue"`
	ConversionRateBasisPoints int         `json:"conversionRateBasisPoints"`
}

type SeriesPoint struct {
	PeriodStart string      `json:"periodStart"`
	GrossSales  money.Money `json:"grossSales"`
	NetSales    money.Money `json:"netSales"`
	OrdersCount int         `json:"ordersCount"`
	StoreViews  int         `json:"storeViews"`
}

type AnalyticsOverview struct {
	ComparableTotals
	From                 string           `json:"from"`
	To                   string           `json:"to"`
	RequestedFrom        string           `json:"requestedFrom"`
	HistoryLimitedToDays *int             `json:"historyLimitedToDays"`
	Refunds              money.Money      `json:"refunds"`
	Fees                 money.Money      `json:"fees"`
	RefundedOrdersCount  int              `json:"refundedOrdersCount"`
	UnitsSold            int              `json:"unitsSold"`
	StoreViews           int              `json:"storeViews"`
	Visitors             int              `json:"visitors"`
	Previous             ComparableTotals `json:"previous"`
	Bucket               string           `json:"bucket"`
	Series               []SeriesPoint    `json:"series"`
}

type ProductPerformance struct {
	ProductId                 string      `json:"productId"`
	Name                      string      `json:"name"`
	ImageUrl                  *string     `json:"imageUrl"`
	CategoryName              string      `json:"categoryName"`
	UnitsSold                 int         `json:"unitsSold"`
	Revenue                   money.Money `json:"revenue"`
	ProductViews              int         `json:"productViews"`
	ConversionRateBasisPoints int         `json:"conversionRateBasisPoints"`
	StockAvailable            int         `json:"stockAvailable"`
	LastSoldAt                *string     `json:"lastSoldAt"`
}

type SegmentRow struct {
	Key              string      `json:"key"`
	Label            string      `json:"label"`
	OrdersCount      int         `json:"ordersCount"`
	UnitsSold        int         `json:"unitsSold"`
	Revenue          money.Money `json:"revenue"`
	ShareBasisPoints int         `json:"shareBasisPoints"`
}

type TimeSlotRow struct {
	Slot        int         `json:"slot"`
	OrdersCount int         `json:"ordersCount"`
	Revenue     money.Money `json:"revenue"`
}

type RefundRow struct {
	Id           string      `json:"id"`
	OrderId      string      `json:"orderId"`
	OrderNumber  string      `json:"orderNumber"`
	CustomerName string      `json:"customerName"`
	Amount       money.Money `json:"amount"`
	Reason       string      `json:"reason"`
	RefundedAt   string      `json:"refundedAt"`
}

type AnalyticsBreakdowns struct {
	From         string               `json:"from"`
	To           string               `json:"to"`
	BestProducts []ProductPerformance `json:"bestProducts"`
	SlowProducts []ProductPerformance `json:"slowProducts"`
	ByCategory   []SegmentRow         `json:"byCategory"`
	ByState      []SegmentRow         `json:"byState"`
	ByCity       []SegmentRow         `json:"byCity"`
	ByHourOfDay  []TimeSlotRow        `json:"byHourOfDay"`
	ByWeekday    []TimeSlotRow        `json:"byWeekday"`
	Refunds      []RefundRow          `json:"refunds"`
}
