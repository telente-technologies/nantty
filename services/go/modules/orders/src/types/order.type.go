package types

import (
	"time"

	"zudomart/platform/money"
)

type UserSummaryView struct {
	Id        string  `json:"id"`
	Name      string  `json:"name"`
	Username  string  `json:"username"`
	AvatarUrl *string `json:"avatarUrl"`
	Verified  bool    `json:"verified"`
}

type StoreSummaryView struct {
	Id          string  `json:"id"`
	Name        string  `json:"name"`
	LogoUrl     *string `json:"logoUrl"`
	Rating      float64 `json:"rating"`
	RatingCount int     `json:"ratingCount"`
	ReviewCount int     `json:"reviewCount"`
}

type OrderView struct {
	Id               string           `json:"id"`
	Reference        string           `json:"reference"`
	Status           string           `json:"status"`
	FulfilmentStatus string           `json:"fulfilmentStatus"`
	PaymentStatus    string           `json:"paymentStatus"`
	Items            []CartItemView   `json:"items"`
	Subtotal         money.Money      `json:"subtotal"`
	Discount         money.Money      `json:"discount"`
	StoreCredit      money.Money      `json:"storeCredit"`
	Shipping         money.Money      `json:"shipping"`
	Total            money.Money      `json:"total"`
	Buyer            UserSummaryView  `json:"buyer"`
	Store            StoreSummaryView `json:"store"`
	CheckoutId       string           `json:"checkoutId"`
	CreatedAt        time.Time        `json:"createdAt"`
	EscrowReleaseAt  *time.Time       `json:"escrowReleaseAt"`
	Shipment         *ShipmentView    `json:"shipment"`
	DeliveredAt      *time.Time       `json:"deliveredAt"`
}

type ShipmentView struct {
	CourierName         string     `json:"courierName"`
	TrackingNumber      string     `json:"trackingNumber"`
	TrackingUrl         *string    `json:"trackingUrl"`
	ShippedAt           time.Time  `json:"shippedAt"`
	EstimatedDeliveryAt *time.Time `json:"estimatedDeliveryAt"`
}

type CheckoutResultView struct {
	CheckoutId        string      `json:"checkoutId"`
	PayableCheckoutId string      `json:"payableCheckoutId"`
	PayableOrderId    string      `json:"payableOrderId"`
	OrderGroups       []OrderView `json:"orderGroups"`
	Orders            []OrderView `json:"orders"`
	Total             money.Money `json:"total"`
	SkippedStoreIds   []string    `json:"skippedStoreIds"`
}
