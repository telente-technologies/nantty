package services

import (
	"encoding/json"
	"time"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/escrow"
	"nantty/modules/escrow/src/modules/escrows/dtos"
)

const sellerPreparationAllowance = 72 * time.Hour

func EscrowStageForBuyerAndSeller(held *ent.Escrow) string {
	switch held.Status {
	case escrow.StatusRefunded, escrow.StatusPartiallyRefunded, escrow.StatusClawedBack:
		return "refunded"
	case escrow.StatusReleased:
		return "released_to_seller"
	case escrow.StatusDisputed:
		return "disputed"
	}
	switch {
	case IsUnderUndeliveredReview(held):
		return "under_review"
	case held.DeliveredAt != nil:
		return "delivered"
	case held.ShippedAt != nil:
		return "shipped"
	}
	return "seller_preparing"
}

func ExpectedEscrowReleaseAt(held *ent.Escrow, inspectionPeriod time.Duration) *time.Time {
	switch held.Status {
	case escrow.StatusReleased:
		return held.ReleasedAt
	case escrow.StatusDisputed, escrow.StatusRefunded, escrow.StatusPartiallyRefunded, escrow.StatusClawedBack:
		return nil
	}
	if IsUnderUndeliveredReview(held) {
		return nil
	}
	var expected time.Time
	switch {
	case held.AutoReleaseAt != nil && held.DeliveredAt != nil:
		expected = *held.AutoReleaseAt
	case held.EstimatedDeliveryAt != nil:
		expected = held.EstimatedDeliveryAt.Add(inspectionPeriod)
	default:
		expected = held.CreatedAt.Add(2*sellerPreparationAllowance + inspectionPeriod)
	}
	return &expected
}

func money(amountMinor int64, currency string) dtos.MoneyDto {
	return dtos.MoneyDto{AmountMinor: amountMinor, Currency: currency}
}

func ConvertEscrowToDetail(held *ent.Escrow, inspectionPeriod time.Duration, disputeId *string, events []*ent.EscrowEvent) dtos.EscrowDetailDto {
	paidAt := held.CreatedAt
	detail := dtos.EscrowDetailDto{
		EscrowId: held.ID.String(), OrderId: held.OrderID, OrderReference: held.OrderReference, Stage: EscrowStageForBuyerAndSeller(held), Status: string(held.Status),
		HeldAmount: money(held.AmountMinor, held.Currency), PlatformFee: money(held.CommissionMinor, held.Currency),
		SellerPayoutAmount: money(held.SellerAmountMinor, held.Currency), RefundedAmount: money(held.RefundedMinor, held.Currency),
		Buyer: dtos.PartySummaryDto{Id: held.BuyerUserID}, Store: dtos.PartySummaryDto{Id: held.StoreID}, SellerUserId: held.SellerUserID,
		PaidAt: &paidAt, PreparingSince: &paidAt, DeliveredAt: held.DeliveredAt, BuyerConfirmedAt: held.BuyerConfirmedAt,
		AutoReleaseAt: held.AutoReleaseAt, ExpectedReleaseAt: ExpectedEscrowReleaseAt(held, inspectionPeriod),
		ReleasedAt: held.ReleasedAt, RefundedAt: held.RefundedAt, DisputeId: disputeId, UndeliveredReviewAt: held.UndeliveredReviewAt,
		FeesKeptOnRefund: money(FeesKeptOnRefund(held), held.Currency),
	}
	if held.ShippedAt != nil {
		shipment := &dtos.ShipmentDetailsDto{CourierName: held.CourierName, TrackingNumber: held.TrackingNumber, ShippedAt: *held.ShippedAt, EstimatedDeliveryAt: held.EstimatedDeliveryAt}
		if held.TrackingURL != "" {
			trackingUrl := held.TrackingURL
			shipment.TrackingUrl = &trackingUrl
		}
		detail.Shipment = shipment
	}
	for _, event := range events {
		details := map[string]any{}
		_ = json.Unmarshal(event.Details, &details)
		detail.Timeline = append(detail.Timeline, dtos.EscrowTimelineEventDto{Type: event.EventType, At: event.CreatedAt, Details: details})
	}
	return detail
}

func ConvertEscrowToSellerHold(held *ent.Escrow, inspectionPeriod time.Duration) dtos.EscrowHoldDto {
	return dtos.EscrowHoldDto{
		OrderId: held.OrderID, OrderReference: held.OrderReference, ProductName: held.ProductSummary,
		Amount: money(held.SellerAmountMinor, held.Currency), Stage: EscrowStageForBuyerAndSeller(held),
		ExpectedReleaseAt: ExpectedEscrowReleaseAt(held, inspectionPeriod),
	}
}

func ConvertEscrowToUndeliveredReviewRow(held *ent.Escrow) dtos.UndeliveredReviewRowDto {
	return dtos.UndeliveredReviewRowDto{
		EscrowId: held.ID.String(), OrderId: held.OrderID, OrderReference: held.OrderReference, BuyerUserId: held.BuyerUserID, SellerUserId: held.SellerUserID,
		StoreId: held.StoreID, HeldAmount: money(held.AmountMinor, held.Currency), HeldSince: held.CreatedAt, ReviewSince: *held.UndeliveredReviewAt,
		ShippedAt: held.ShippedAt, CourierName: held.CourierName, TrackingNumber: held.TrackingNumber,
	}
}
