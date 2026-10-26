package types

import (
	"time"

	"nantty/platform/money"
)

type SellerBuyerView struct {
	Id       string  `json:"id"`
	Name     string  `json:"name"`
	Username string  `json:"username"`
	Phone    *string `json:"phone"`
}

type SellerAddressView struct {
	RecipientName string `json:"recipientName"`
	Phone         string `json:"phone"`
	Line1         string `json:"line1"`
	City          string `json:"city"`
	State         string `json:"state"`
	Country       string `json:"country"`
}

type SellerOrderLineView struct {
	Id           string      `json:"id"`
	ProductId    string      `json:"productId"`
	VariantId    string      `json:"variantId"`
	Name         string      `json:"name"`
	VariantTitle string      `json:"variantTitle"`
	Sku          string      `json:"sku"`
	ImageUrl     *string     `json:"imageUrl"`
	Quantity     int         `json:"quantity"`
	UnitPrice    money.Money `json:"unitPrice"`
	LineTotal    money.Money `json:"lineTotal"`
}

type SellerFulfilmentView struct {
	Courier        string    `json:"courier"`
	TrackingNumber string    `json:"trackingNumber"`
	TrackingUrl    *string   `json:"trackingUrl"`
	ShippedAt      time.Time `json:"shippedAt"`
	FromLocationId string    `json:"fromLocationId"`
}

type SellerDeliveryView struct {
	Status              string     `json:"status"`
	RiderName           *string    `json:"riderName"`
	RiderPhone          *string    `json:"riderPhone"`
	EstimatedDeliveryAt *time.Time `json:"estimatedDeliveryAt"`
	Attempts            int        `json:"attempts"`
	LastAttemptNote     *string    `json:"lastAttemptNote"`
}

type TimelineEventView struct {
	Id        string    `json:"id"`
	Kind      string    `json:"kind"`
	Summary   string    `json:"summary"`
	ActorName *string   `json:"actorName"`
	CreatedAt time.Time `json:"createdAt"`
}

type InternalNoteView struct {
	Id         string    `json:"id"`
	Body       string    `json:"body"`
	AuthorName string    `json:"authorName"`
	CreatedAt  time.Time `json:"createdAt"`
}

type RefundView struct {
	Id        string      `json:"id"`
	Amount    money.Money `json:"amount"`
	Reason    string      `json:"reason"`
	CreatedAt time.Time   `json:"createdAt"`
}

type SellerOrderView struct {
	Id                string                `json:"id"`
	OrderNumber       string                `json:"orderNumber"`
	InvoiceNumber     string                `json:"invoiceNumber"`
	Buyer             SellerBuyerView       `json:"buyer"`
	ShippingAddress   SellerAddressView     `json:"shippingAddress"`
	Lines             []SellerOrderLineView `json:"lines"`
	Subtotal          money.Money           `json:"subtotal"`
	Discount          money.Money           `json:"discount"`
	StoreCredit       money.Money           `json:"storeCredit"`
	ShippingFee       money.Money           `json:"shippingFee"`
	Total             money.Money           `json:"total"`
	SellerPayout      money.Money           `json:"sellerPayout"`
	Status            string                `json:"status"`
	EscrowStatus      string                `json:"escrowStatus"`
	EscrowReleaseAt   *time.Time            `json:"escrowReleaseAt"`
	Fulfilment        *SellerFulfilmentView `json:"fulfilment"`
	AttributedCreator any                   `json:"attributedCreator"`
	CreatedAt         time.Time             `json:"createdAt"`
	DeliveredAt       *time.Time            `json:"deliveredAt"`
	PaymentStatus     string                `json:"paymentStatus"`
	PaymentMode       string                `json:"paymentMode"`
	PaymentProvider   string                `json:"paymentProvider"`
	PaymentReference  string                `json:"paymentReference"`
	PaidAt            *time.Time            `json:"paidAt"`
	RefundedAmount    money.Money           `json:"refundedAmount"`
	Refunds           []RefundView          `json:"refunds"`
	Delivery          SellerDeliveryView    `json:"delivery"`
	Timeline          []TimelineEventView   `json:"timeline"`
	Notes             []InternalNoteView    `json:"notes"`
	ConversationId    *string               `json:"conversationId"`
}
