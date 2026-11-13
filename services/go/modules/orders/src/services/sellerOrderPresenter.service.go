package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/orderevent"
	"nantty/modules/orders/src/generated/ent/ordernote"
	"nantty/modules/orders/src/types"
	"nantty/platform/money"
)

func EscrowStatusFor(group *ent.OrderGroup) string {
	switch {
	case group.Status == enums.StatusDisputed:
		return "disputed"
	case group.Status == enums.StatusCompleted:
		return "released"
	case group.Status == enums.StatusRefunded || (group.Status == enums.StatusCancelled && group.PaymentStatus != enums.PaymentPending):
		return "refunded"
	}
	return "held"
}

func SellerOrderViews(ctx context.Context, deployed *container.Container, groups []*ent.OrderGroup, withDetail bool) ([]types.SellerOrderView, error) {
	groupIds := UniqueIdentifiers(groups, func(group *ent.OrderGroup) uuid.UUID { return group.ID })
	items, err := LoadItemsByGroup(ctx, deployed, groupIds)
	if err != nil {
		return nil, err
	}
	timelines, notes := map[uuid.UUID][]*ent.OrderEvent{}, map[uuid.UUID][]*ent.OrderNote{}
	if withDetail {
		events, err := deployed.Client.OrderEvent.Query().Where(orderevent.OrderGroupIDIn(groupIds...)).Order(ent.Asc(orderevent.FieldCreatedAt), ent.Asc(orderevent.FieldID)).All(ctx)
		if err != nil {
			return nil, err
		}
		for _, row := range events {
			timelines[row.OrderGroupID] = append(timelines[row.OrderGroupID], row)
		}
		noteRows, err := deployed.Client.OrderNote.Query().Where(ordernote.OrderGroupIDIn(groupIds...)).Order(ent.Asc(ordernote.FieldCreatedAt), ent.Asc(ordernote.FieldID)).All(ctx)
		if err != nil {
			return nil, err
		}
		for _, row := range noteRows {
			notes[row.OrderGroupID] = append(notes[row.OrderGroupID], row)
		}
	}
	views := make([]types.SellerOrderView, 0, len(groups))
	for _, group := range groups {
		views = append(views, sellerOrderView(group, items[group.ID], timelines[group.ID], notes[group.ID]))
	}
	return views, nil
}

func sellerOrderView(group *ent.OrderGroup, items []*ent.OrderItem, timeline []*ent.OrderEvent, notes []*ent.OrderNote) types.SellerOrderView {
	address := group.Address
	phone := address.Phone
	view := types.SellerOrderView{
		Id: group.ID.String(), OrderNumber: group.Reference, InvoiceNumber: group.InvoiceNumber,
		Buyer:           types.SellerBuyerView{Id: group.BuyerAccountID.String(), Name: group.BuyerName, Username: group.BuyerUsername, Phone: &phone},
		ShippingAddress: types.SellerAddressView{RecipientName: address.RecipientName, Phone: address.Phone, Line1: address.Line1, Line2: address.Line2, PostalCode: address.PostalCode, Details: address.Details, City: firstNonEmpty(address.CityName, address.AdminAreaName), State: address.RegionName, Country: address.CountryCode},
		Lines:           []types.SellerOrderLineView{}, Subtotal: groupMoney(group, group.SubtotalMinor), Discount: groupMoney(group, group.DiscountMinor), StoreCredit: groupMoney(group, group.StoreCreditMinor), ShippingFee: groupMoney(group, group.ShippingMinor),
		Total: groupMoney(group, group.TotalMinor), SellerPayout: groupMoney(group, group.SubtotalMinor-group.DiscountMinor-group.StoreCreditMinor), Status: group.Status, EscrowStatus: EscrowStatusFor(group),
		EscrowReleaseAt: group.EscrowReleaseAt, CreatedAt: group.CreatedAt, DeliveredAt: group.DeliveredAt, PaymentStatus: group.PaymentStatus, PaymentMode: group.PaymentMode, PaymentProvider: "transfer",
		PaymentReference: group.Reference, PaidAt: group.PaidAt, RefundedAmount: groupMoney(group, group.RefundedMinor), Refunds: []types.RefundView{},
		Delivery: types.SellerDeliveryView{Status: group.DeliveryStatus, RiderName: group.RiderName, RiderPhone: group.RiderPhone, EstimatedDeliveryAt: group.EstimatedDeliveryAt, Attempts: group.DeliveryAttempts, LastAttemptNote: group.LastAttemptNote},
		Timeline: []types.TimelineEventView{}, Notes: []types.InternalNoteView{},
	}
	for _, item := range items {
		view.Lines = append(view.Lines, types.SellerOrderLineView{
			Id: item.ID.String(), ProductId: item.ProductID.String(), VariantId: item.VariantID.String(), Name: item.ProductName, VariantTitle: item.VariantTitle, Sku: item.Sku,
			ImageUrl: item.ImageURL, Quantity: item.Quantity, UnitPrice: money.Money{AmountMinor: item.UnitPriceMinor, Currency: money.CurrencyCode(group.Currency)},
			LineTotal: money.Money{AmountMinor: item.LineTotalMinor, Currency: money.CurrencyCode(group.Currency)},
		})
	}
	if group.ShippedAt != nil && group.CourierName != nil && group.TrackingNumber != nil && group.FromLocationID != nil {
		view.Fulfilment = &types.SellerFulfilmentView{Courier: *group.CourierName, TrackingNumber: *group.TrackingNumber, TrackingUrl: group.TrackingURL, ShippedAt: *group.ShippedAt, FromLocationId: group.FromLocationID.String()}
	}
	for _, row := range timeline {
		event := types.TimelineEventView{Id: row.ID.String(), Kind: row.Kind, Summary: row.Summary, CreatedAt: row.CreatedAt}
		if row.ActorName != "" {
			name := row.ActorName
			event.ActorName = &name
		}
		view.Timeline = append(view.Timeline, event)
	}
	for _, row := range notes {
		view.Notes = append(view.Notes, types.InternalNoteView{Id: row.ID.String(), Body: row.Body, AuthorName: row.AuthorName, CreatedAt: row.CreatedAt})
	}
	if group.RefundedMinor > 0 {
		view.Refunds = append(view.Refunds, types.RefundView{Id: group.ID.String(), Amount: groupMoney(group, group.RefundedMinor), Reason: "Refund recorded by escrow", CreatedAt: group.UpdatedAt})
	}
	return view
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
