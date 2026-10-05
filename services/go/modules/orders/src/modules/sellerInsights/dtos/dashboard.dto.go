package dtos

import (
	"encoding/json"

	"zudomart/platform/money"
)

type PeriodSales struct {
	Label       string      `json:"label"`
	Current     money.Money `json:"current"`
	Previous    money.Money `json:"previous"`
	OrdersCount int         `json:"ordersCount"`
}

type LifetimeSales struct {
	Total       money.Money `json:"total"`
	OrdersCount int         `json:"ordersCount"`
}

type StatusCount struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

type DailyRevenuePoint struct {
	Date        string      `json:"date"`
	Revenue     money.Money `json:"revenue"`
	OrdersCount int         `json:"ordersCount"`
}

type TopProduct struct {
	ProductId string      `json:"productId"`
	Name      string      `json:"name"`
	ImageUrl  *string     `json:"imageUrl"`
	UnitsSold int         `json:"unitsSold"`
	Revenue   money.Money `json:"revenue"`
}

type LowStockAlert struct {
	VariantId         string `json:"variantId"`
	ProductId         string `json:"productId"`
	ProductName       string `json:"productName"`
	VariantTitle      string `json:"variantTitle"`
	Sku               string `json:"sku"`
	LocationId        string `json:"locationId"`
	Available         int    `json:"available"`
	LowStockThreshold int    `json:"lowStockThreshold"`
}

type CatalogSummary struct {
	TotalProducts   int `json:"totalProducts"`
	ActiveProducts  int `json:"activeProducts"`
	DraftProducts   int `json:"draftProducts"`
	LowStockCount   int `json:"lowStockCount"`
	OutOfStockCount int `json:"outOfStockCount"`
}

type TrafficSummary struct {
	StoreViews                        int   `json:"storeViews"`
	PreviousStoreViews                int   `json:"previousStoreViews"`
	Visitors                          int   `json:"visitors"`
	ConversionRateBasisPoints         int   `json:"conversionRateBasisPoints"`
	PreviousConversionRateBasisPoints int   `json:"previousConversionRateBasisPoints"`
	DailyStoreViews                   []int `json:"dailyStoreViews"`
}

type CustomerGrowth struct {
	TotalCustomers       int   `json:"totalCustomers"`
	NewCustomers         int   `json:"newCustomers"`
	PreviousNewCustomers int   `json:"previousNewCustomers"`
	ReturningCustomers   int   `json:"returningCustomers"`
	DailyNewCustomers    []int `json:"dailyNewCustomers"`
}

type RecentOrder struct {
	Id               string      `json:"id"`
	OrderNumber      string      `json:"orderNumber"`
	CustomerName     string      `json:"customerName"`
	CustomerUsername string      `json:"customerUsername"`
	ItemsCount       int         `json:"itemsCount"`
	Total            money.Money `json:"total"`
	Status           string      `json:"status"`
	CreatedAt        string      `json:"createdAt"`
}

type ActivityEntry struct {
	Id        string  `json:"id"`
	Kind      string  `json:"kind"`
	Summary   string  `json:"summary"`
	ActorName *string `json:"actorName"`
	Href      *string `json:"href"`
	CreatedAt string  `json:"createdAt"`
}

type Alert struct {
	Kind        string `json:"kind"`
	Severity    string `json:"severity"`
	Count       int    `json:"count"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Href        string `json:"href"`
}

type DashboardSummary struct {
	LocationId     *string             `json:"locationId"`
	GeneratedAt    string              `json:"generatedAt"`
	SalesToday     PeriodSales         `json:"salesToday"`
	SalesThisWeek  PeriodSales         `json:"salesThisWeek"`
	SalesThisMonth PeriodSales         `json:"salesThisMonth"`
	LifetimeSales  LifetimeSales       `json:"lifetimeSales"`
	OrdersByStatus []StatusCount       `json:"ordersByStatus"`
	DailyRevenue   []DailyRevenuePoint `json:"dailyRevenue"`
	TopProducts    []TopProduct        `json:"topProducts"`
	LowStockAlerts []LowStockAlert     `json:"lowStockAlerts"`
	Catalog        CatalogSummary      `json:"catalog"`
	Traffic        TrafficSummary      `json:"traffic"`
	CustomerGrowth CustomerGrowth      `json:"customerGrowth"`
	Balances       json.RawMessage     `json:"balances"`
	RecentOrders   []RecentOrder       `json:"recentOrders"`
	Activity       []ActivityEntry     `json:"activity"`
	Alerts         []Alert             `json:"alerts"`
}
