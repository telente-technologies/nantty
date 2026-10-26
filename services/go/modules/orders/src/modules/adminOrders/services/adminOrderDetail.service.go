package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/orderevent"
	"nantty/modules/orders/src/generated/ent/orderitem"
	"nantty/modules/orders/src/generated/ent/refundrecord"
	"nantty/modules/orders/src/modules/adminOrders/dtos"
	"nantty/modules/orders/src/types"
)

func Detail(ctx context.Context, deployed *container.Container, group *ent.OrderGroup) (dtos.OrderDetail, error) {
	items, err := deployed.Client.OrderItem.Query().Where(orderitem.OrderGroupID(group.ID)).Order(ent.Asc(orderitem.FieldID)).All(ctx)
	if err != nil {
		return dtos.OrderDetail{}, err
	}
	events, err := deployed.Client.OrderEvent.Query().Where(orderevent.OrderGroupID(group.ID)).Order(ent.Asc(orderevent.FieldID)).All(ctx)
	if err != nil {
		return dtos.OrderDetail{}, err
	}
	refunds, err := deployed.Client.RefundRecord.Query().Where(refundrecord.OrderGroupID(group.ID)).Order(ent.Desc(refundrecord.FieldID)).All(ctx)
	if err != nil {
		return dtos.OrderDetail{}, err
	}
	directory := LoadDirectory(ctx, deployed, []uuid.UUID{group.BuyerAccountID, group.SellerAccountID}, []uuid.UUID{group.StoreID})
	detail := dtos.OrderDetail{
		OrderSummary: Summary(group, items, directory), Items: make([]dtos.OrderItem, 0, len(items)), Subtotal: moneyOf(group.SubtotalMinor, group.Currency),
		Discount: moneyOf(group.DiscountMinor, group.Currency), StoreCredit: moneyOf(group.StoreCreditMinor, group.Currency), DeliveryFee: moneyOf(group.ShippingMinor, group.Currency),
		RefundedTotal: moneyOf(group.RefundedMinor, group.Currency), Refundable: moneyOf(RefundableMinor(group), group.Currency),
		DeliveryCity: group.Address.CityName, DeliveryState: group.Address.RegionName, Courier: group.CourierName, TrackingNumber: group.TrackingNumber,
		Refunds: make([]dtos.RefundRecord, 0, len(refunds)), Timeline: make([]dtos.TimelineEvent, 0, len(events)),
	}
	for _, item := range items {
		line := dtos.OrderItem{Id: item.ID.String(), ProductId: item.ProductID.String(), ProductName: item.ProductName, Variant: item.VariantTitle, ImageUrl: item.ImageURL,
			Quantity: item.Quantity, UnitPrice: moneyOf(item.UnitPriceMinor, group.Currency), LineTotal: moneyOf(item.LineTotalMinor, group.Currency)}
		if item.AttributionSource != nil && item.AttributionID != nil {
			line.Attribution = &types.SaleAttributionView{Source: *item.AttributionSource, Id: item.AttributionID.String()}
		}
		detail.Items = append(detail.Items, line)
	}
	for _, record := range refunds {
		detail.Refunds = append(detail.Refunds, RefundView(record, directory))
	}
	for _, event := range events {
		detail.Timeline = append(detail.Timeline, dtos.TimelineEvent{Id: event.ID.String(), Kind: event.Kind, Summary: event.Summary, ActorKind: event.ActorKind, ActorName: event.ActorName, OccurredAt: event.CreatedAt})
	}
	if deployed.Money != nil && group.PaymentStatus != "pending" {
		if escrow, err := deployed.Money.GetOrderEscrow(ctx, group.ID.String()); err == nil && escrow.Status != "" {
			detail.EscrowStatus = escrow.Status
			detail.Escrow = &dtos.EscrowState{Status: escrow.Status, HeldAmount: escrow.HeldAmount, Commission: escrow.PlatformFee, SellerAmount: escrow.SellerAmount,
				Refunded: moneyOf(escrow.RefundedMinor, group.Currency), AutoReleaseAt: escrow.AutoReleaseAt, ReleasedAt: escrow.ReleasedAt, RefundedAt: escrow.RefundedAt}
		}
	}
	return detail, nil
}

func RefundableMinor(group *ent.OrderGroup) int64 {
	if group.PaymentStatus != "paid" || group.RefundRequestedAt != nil {
		return 0
	}
	return max(group.TotalMinor-group.RefundedMinor, 0)
}
