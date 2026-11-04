package dtos

import "nantty/platform/money"

type OrderWidgetItem struct {
	Id          string  `json:"id"`
	Reference   string  `json:"reference"`
	Status      string  `json:"status"`
	StatusLabel string  `json:"statusLabel"`
	EtaAt       *string `json:"etaAt"`
	TrackingURL *string `json:"trackingUrl,omitempty"`
	ItemTitle   string  `json:"itemTitle"`
	ItemCount   int     `json:"itemCount"`
	ImageUrl    *string `json:"imageUrl"`
	StoreName   string  `json:"storeName"`
	DeepLink    string  `json:"deepLink"`
	UpdatedAt   string  `json:"updatedAt"`
}

type OrderWidgetPayload struct {
	Orders      []OrderWidgetItem `json:"orders"`
	ActiveCount int               `json:"activeCount"`
	GeneratedAt string            `json:"generatedAt"`
}

type SellerTodayWidgetPayload struct {
	StoreName        string       `json:"storeName"`
	SalesToday       *money.Money `json:"salesToday"`
	OrdersToday      int          `json:"ordersToday"`
	OrdersToShip     int          `json:"ordersToShip"`
	AvailableBalance *money.Money `json:"availableBalance"`
	AmountsHidden    bool         `json:"amountsHidden"`
	DeepLink         string       `json:"deepLink"`
	GeneratedAt      string       `json:"generatedAt"`
}
