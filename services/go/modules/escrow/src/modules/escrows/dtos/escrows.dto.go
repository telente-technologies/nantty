package dtos

import "time"

type MoneyDto struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type PartySummaryDto struct {
	Id string `json:"id"`
}

type ShipmentDetailsDto struct {
	CourierName         string     `json:"courierName"`
	TrackingNumber      string     `json:"trackingNumber"`
	TrackingUrl         *string    `json:"trackingUrl"`
	ShippedAt           time.Time  `json:"shippedAt"`
	EstimatedDeliveryAt *time.Time `json:"estimatedDeliveryAt"`
}

type EscrowTimelineEventDto struct {
	Type    string         `json:"type"`
	At      time.Time      `json:"at"`
	Details map[string]any `json:"details"`
}

type EscrowDetailDto struct {
	EscrowId           string                   `json:"escrowId"`
	OrderId            string                   `json:"orderId"`
	OrderReference     string                   `json:"orderReference"`
	Stage              string                   `json:"stage"`
	Status             string                   `json:"status"`
	HeldAmount         MoneyDto                 `json:"heldAmount"`
	PlatformFee        MoneyDto                 `json:"platformFee"`
	SellerPayoutAmount MoneyDto                 `json:"sellerPayoutAmount"`
	RefundedAmount     MoneyDto                 `json:"refundedAmount"`
	Buyer              PartySummaryDto          `json:"buyer"`
	Store              PartySummaryDto          `json:"store"`
	SellerUserId       string                   `json:"sellerUserId"`
	PaidAt             *time.Time               `json:"paidAt"`
	PreparingSince     *time.Time               `json:"preparingSince"`
	Shipment           *ShipmentDetailsDto      `json:"shipment"`
	DeliveredAt        *time.Time               `json:"deliveredAt"`
	BuyerConfirmedAt   *time.Time               `json:"buyerConfirmedAt"`
	AutoReleaseAt      *time.Time               `json:"autoReleaseAt"`
	ExpectedReleaseAt  *time.Time               `json:"expectedReleaseAt"`
	ReleasedAt         *time.Time               `json:"releasedAt"`
	RefundedAt         *time.Time               `json:"refundedAt"`
	DisputeId          *string                  `json:"disputeId"`
	RefundScheduled    *ScheduledRefundDto      `json:"refundScheduled"`
	Timeline           []EscrowTimelineEventDto `json:"timeline,omitempty"`
}

type ScheduledRefundDto struct {
	Status      string    `json:"status"`
	Amount      MoneyDto  `json:"amount"`
	Reason      string    `json:"reason"`
	ScheduledAt time.Time `json:"scheduledAt"`
}

type EscrowHoldDto struct {
	OrderId           string     `json:"orderId"`
	OrderReference    string     `json:"orderReference"`
	ProductName       string     `json:"productName"`
	Amount            MoneyDto   `json:"amount"`
	Stage             string     `json:"stage"`
	ExpectedReleaseAt *time.Time `json:"expectedReleaseAt"`
}

type AdminRefundEscrowRequestDto struct {
	Reason string `json:"reason"`
}
