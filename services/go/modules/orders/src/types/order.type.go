package types

import (
	"time"

	"nantty/platform/money"
)

type UserSummaryView struct {
	Id        string  `json:"id"`
	Name      string  `json:"name"`
	Username  string  `json:"username"`
	AvatarUrl *string `json:"avatarUrl"`
	Verified  bool    `json:"verified"`
}

type StoreSummaryView struct {
	Id          string   `json:"id"`
	Name        string   `json:"name"`
	LogoUrl     *string  `json:"logoUrl"`
	Verified    bool     `json:"verified"`
	SuccessRate *float64 `json:"successRate"`
	Rating      float64  `json:"rating"`
	RatingCount int      `json:"ratingCount"`
	ReviewCount int      `json:"reviewCount"`
}

type OrderView struct {
	Id               string                   `json:"id"`
	Reference        string                   `json:"reference"`
	Status           string                   `json:"status"`
	FulfilmentStatus string                   `json:"fulfilmentStatus"`
	PaymentStatus    string                   `json:"paymentStatus"`
	PaymentMode      string                   `json:"paymentMode"`
	Items            []CartItemView           `json:"items"`
	Subtotal         money.Money              `json:"subtotal"`
	Discount         money.Money              `json:"discount"`
	StoreCredit      money.Money              `json:"storeCredit"`
	Shipping         money.Money              `json:"shipping"`
	Total            money.Money              `json:"total"`
	Buyer            UserSummaryView          `json:"buyer"`
	Store            StoreSummaryView         `json:"store"`
	CheckoutId       string                   `json:"checkoutId"`
	CreatedAt        time.Time                `json:"createdAt"`
	EscrowReleaseAt  *time.Time               `json:"escrowReleaseAt"`
	Shipment         *ShipmentView            `json:"shipment"`
	Delivery         *DeliveryView            `json:"delivery"`
	Timeline         []OrderTimelineEventView `json:"timeline"`
	PromotionIssue   *PromotionIssueView      `json:"promotionIssue"`
	DeliveredAt      *time.Time               `json:"deliveredAt"`
}

type OrderTimelineEventView struct {
	Id        string    `json:"id"`
	Kind      string    `json:"kind"`
	Summary   string    `json:"summary"`
	CreatedAt time.Time `json:"createdAt"`
}

type PromotionIssueView struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type ShipmentView struct {
	CourierName         string     `json:"courierName"`
	TrackingNumber      string     `json:"trackingNumber"`
	ShippedAt           time.Time  `json:"shippedAt"`
	EstimatedDeliveryAt *time.Time `json:"estimatedDeliveryAt"`
}

type DeliveryView struct {
	Status              string     `json:"status"`
	RiderName           *string    `json:"riderName"`
	RiderPhone          *string    `json:"riderPhone"`
	EstimatedDeliveryAt *time.Time `json:"estimatedDeliveryAt"`
	Attempts            int        `json:"attempts"`
	LastAttemptNote     *string    `json:"lastAttemptNote"`
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
