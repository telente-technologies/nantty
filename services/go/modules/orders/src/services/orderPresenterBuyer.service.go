package services

import (
	"time"

	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/types"
	"nantty/platform/commerceports"
	"nantty/platform/money"
	"nantty/platform/usersdirectory"
)

func groupMoney(group *ent.OrderGroup, amountMinor int64) money.Money {
	return money.Money{AmountMinor: amountMinor, Currency: money.CurrencyCode(group.Currency)}
}

func buyerOrderView(group *ent.OrderGroup, items []*ent.OrderItem, store commerceports.StoreSnapshot, buyer usersdirectory.ProfileName, successRate *float64, events []*ent.OrderEvent) types.OrderView {
	view := types.OrderView{
		Id: group.ID.String(), Reference: group.Reference, Status: BuyerStatusFor(group.Status), FulfilmentStatus: group.Status, PaymentStatus: group.PaymentStatus, PaymentMode: group.PaymentMode,
		Items: make([]types.CartItemView, 0, len(items)), Subtotal: groupMoney(group, group.SubtotalMinor), Discount: groupMoney(group, group.DiscountMinor), StoreCredit: groupMoney(group, group.StoreCreditMinor),
		Shipping: groupMoney(group, group.ShippingMinor), Total: groupMoney(group, group.TotalMinor), CheckoutId: group.CheckoutID.String(),
		CreatedAt: group.CreatedAt, EscrowReleaseAt: group.EscrowReleaseAt, DeliveredAt: group.DeliveredAt,
		Timeline: make([]types.OrderTimelineEventView, 0, len(events)),
		Buyer:    types.UserSummaryView{Id: group.BuyerAccountID.String(), Name: group.BuyerName, Username: group.BuyerUsername, Verified: buyer.Verified},
		Store:    types.StoreSummaryView{Id: group.StoreID.String(), Name: store.Name, Verified: store.Verified, SuccessRate: successRate, Rating: store.RatingAverage, RatingCount: store.RatingCount, ReviewCount: store.RatingCount},
	}
	if buyer.AvatarUrl != "" {
		view.Buyer.AvatarUrl = &buyer.AvatarUrl
	}
	if store.LogoUrl != "" {
		view.Store.LogoUrl = &store.LogoUrl
	}
	for _, item := range items {
		view.Items = append(view.Items, orderItemView(item, group.Currency))
	}
	if group.ShippedAt != nil && group.CourierName != nil && group.TrackingNumber != nil {
		view.Shipment = &types.ShipmentView{CourierName: *group.CourierName, TrackingNumber: *group.TrackingNumber, ShippedAt: *group.ShippedAt, EstimatedDeliveryAt: group.EstimatedDeliveryAt}
	}
	view.Delivery = buyerDeliveryView(group.DeliveryStatus, group.RiderName, group.RiderPhone, group.EstimatedDeliveryAt, group.DeliveryAttempts, group.LastAttemptNote)
	for _, event := range events {
		if summary, visible := buyerTimelineSummary(event.Kind); visible {
			view.Timeline = append(view.Timeline, types.OrderTimelineEventView{Id: event.ID.String(), Kind: event.Kind, Summary: summary, CreatedAt: event.CreatedAt})
		}
	}
	if group.PromotionIssueCode != "" {
		view.PromotionIssue = &types.PromotionIssueView{Code: group.PromotionIssueCode, Message: group.PromotionIssueMessage}
	}
	return view
}

// buyerTimelineSummary maps only public order-state events to fixed copy. It
// never forwards seller/internal note text into a buyer order response.
func buyerTimelineSummary(kind string) (string, bool) {
	summaries := map[string]string{
		"placed":          "Order placed",
		"paid":            "Payment confirmed",
		"accepted":        "Seller accepted the order",
		"processing":      "Seller is preparing your order",
		"ready":           "Order is ready to ship",
		"shipped":         "Order marked as shipped",
		"delivery_failed": "A delivery attempt was unsuccessful",
		"delivered":       "Order marked as delivered",
		"completed":       "Order completed",
		"cancelled":       "Order cancelled",
		"returned":        "Order returned",
		"refunded":        "Payment refunded",
		"disputed":        "A dispute was opened",
	}
	summary, visible := summaries[kind]
	return summary, visible
}

func buyerDeliveryView(status string, riderName, riderPhone *string, estimatedDeliveryAt *time.Time, attempts int, lastAttemptNote *string) *types.DeliveryView {
	if status == "pending" && riderName == nil && riderPhone == nil && estimatedDeliveryAt == nil && attempts == 0 && lastAttemptNote == nil {
		return nil
	}
	return &types.DeliveryView{
		Status: status, RiderName: riderName, RiderPhone: riderPhone, EstimatedDeliveryAt: estimatedDeliveryAt,
		Attempts: attempts, LastAttemptNote: lastAttemptNote,
	}
}
