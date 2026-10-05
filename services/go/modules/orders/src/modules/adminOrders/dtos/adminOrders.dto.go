package dtos

import (
	"time"

	"zudomart/modules/orders/src/types"
	"zudomart/platform/money"
)

type UserSummary struct {
	Id          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName string  `json:"displayName"`
	AvatarUrl   *string `json:"avatarUrl"`
}

type OrderSummary struct {
	Id             string      `json:"id"`
	OrderNumber    string      `json:"orderNumber"`
	InvoiceNumber  string      `json:"invoiceNumber"`
	Buyer          UserSummary `json:"buyer"`
	Seller         UserSummary `json:"seller"`
	StoreId        string      `json:"storeId"`
	StoreName      string      `json:"storeName"`
	Status         string      `json:"status"`
	PaymentStatus  string      `json:"paymentStatus"`
	PaymentMode    string      `json:"paymentMode"`
	EscrowStatus   string      `json:"escrowStatus"`
	DeliveryStatus string      `json:"deliveryStatus"`
	Total          money.Money `json:"total"`
	ItemCount      int         `json:"itemCount"`
	PlacedAt       time.Time   `json:"placedAt"`
}

type OrderItem struct {
	Id          string                     `json:"id"`
	ProductId   string                     `json:"productId"`
	ProductName string                     `json:"productName"`
	Variant     string                     `json:"variant"`
	ImageUrl    *string                    `json:"imageUrl"`
	Quantity    int                        `json:"quantity"`
	UnitPrice   money.Money                `json:"unitPrice"`
	LineTotal   money.Money                `json:"lineTotal"`
	Attribution *types.SaleAttributionView `json:"attribution"`
}

type EscrowState struct {
	Status        string      `json:"status"`
	HeldAmount    money.Money `json:"heldAmount"`
	Commission    money.Money `json:"commission"`
	SellerAmount  money.Money `json:"sellerAmount"`
	Refunded      money.Money `json:"refunded"`
	AutoReleaseAt *time.Time  `json:"autoReleaseAt"`
	ReleasedAt    *time.Time  `json:"releasedAt"`
	RefundedAt    *time.Time  `json:"refundedAt"`
}

type TimelineEvent struct {
	Id         string    `json:"id"`
	Kind       string    `json:"kind"`
	Summary    string    `json:"summary"`
	ActorKind  string    `json:"actorKind"`
	ActorName  string    `json:"actorName"`
	OccurredAt time.Time `json:"occurredAt"`
}

type OrderDetail struct {
	OrderSummary
	Items          []OrderItem     `json:"items"`
	Subtotal       money.Money     `json:"subtotal"`
	Discount       money.Money     `json:"discount"`
	StoreCredit    money.Money     `json:"storeCredit"`
	DeliveryFee    money.Money     `json:"deliveryFee"`
	RefundedTotal  money.Money     `json:"refundedTotal"`
	Refundable     money.Money     `json:"refundable"`
	DeliveryCity   string          `json:"deliveryCity"`
	DeliveryState  string          `json:"deliveryState"`
	Courier        *string         `json:"courier"`
	TrackingNumber *string         `json:"trackingNumber"`
	Escrow         *EscrowState    `json:"escrow"`
	Refunds        []RefundRecord  `json:"refunds"`
	Timeline       []TimelineEvent `json:"timeline"`
}

type RefundRecord struct {
	Id            string      `json:"id"`
	OrderId       string      `json:"orderId"`
	OrderNumber   string      `json:"orderNumber"`
	StoreId       string      `json:"storeId"`
	Buyer         UserSummary `json:"buyer"`
	Amount        money.Money `json:"amount"`
	Source        string      `json:"source"`
	Status        string      `json:"status"`
	Reason        string      `json:"reason"`
	CreatedAt     time.Time   `json:"createdAt"`
	CompletedAt   *time.Time  `json:"completedAt"`
	CreatedByName string      `json:"createdByName"`
}

type IssueRefundRequest struct {
	OrderId string      `json:"orderId"`
	Amount  money.Money `json:"amount"`
	Reason  string      `json:"reason"`
}
