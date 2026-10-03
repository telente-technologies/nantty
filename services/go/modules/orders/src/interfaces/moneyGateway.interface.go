package interfaces

import (
	"context"
	"time"

	"zudomart/platform/money"
)

type OrderPayable struct {
	OrderId        string
	OrderReference string
	StoreId        string
	SellerUserId   string
	Amount         money.Money
	ProductSummary string
	StoreVerified  bool
}

type RegisterPayablesRequest struct {
	CheckoutId  string
	BuyerUserId string
	Orders      []OrderPayable
}

type FulfilmentRecord struct {
	OrderId             string
	Delivered           bool
	OccurredAt          time.Time
	CourierName         string
	TrackingNumber      string
	TrackingUrl         string
	EstimatedDeliveryAt *time.Time
}

type EscrowSummary struct {
	EscrowId      string
	OrderId       string
	Status        string
	AutoReleaseAt *time.Time
	ReleasedAt    *time.Time
	RefundedAt    *time.Time
	HeldAmount    money.Money
	PlatformFee   money.Money
	SellerAmount  money.Money
	RefundedMinor int64
}

type CheckoutMoney interface {
	RegisterCheckoutPayables(ctx context.Context, request RegisterPayablesRequest) error
	RecordOrderFulfilment(ctx context.Context, record FulfilmentRecord) (EscrowSummary, error)
	ConfirmOrderReceipt(ctx context.Context, orderId, buyerUserId string) (EscrowSummary, error)
	GetOrderEscrow(ctx context.Context, orderId string) (EscrowSummary, error)
}
