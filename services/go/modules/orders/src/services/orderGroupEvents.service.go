package services

import (
	"context"
	"strings"

	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/orderitem"
)

func OrderGroupEventData(ctx context.Context, tx *ent.Tx, group *ent.OrderGroup, extra map[string]any) (map[string]any, error) {
	items, err := tx.OrderItem.Query().Where(orderitem.OrderGroupID(group.ID)).Order(ent.Asc(orderitem.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	lines := make([]map[string]any, 0, len(items))
	for _, item := range items {
		lines = append(lines, map[string]any{
			"name": item.ProductName, "variant": orderItemVariantLabel(item), "quantity": item.Quantity,
			"unitPrice": map[string]any{"amountMinor": item.UnitPriceMinor, "currency": group.Currency},
			"imageUrl":  derefOrEmpty(item.ImageURL),
		})
	}
	data := map[string]any{
		"orderGroupId": group.ID, "orderNumber": group.Reference, "checkoutId": group.CheckoutID, "storeId": group.StoreID,
		"sellerAccountId": group.SellerAccountID, "sellerName": group.SellerName, "buyerAccountId": group.BuyerAccountID, "buyerName": group.BuyerName,
		"paymentMode": group.PaymentMode, "currency": group.Currency, "subtotalMinor": group.SubtotalMinor, "discountMinor": group.DiscountMinor,
		"storeCreditMinor": group.StoreCreditMinor, "shippingMinor": group.ShippingMinor, "totalMinor": group.TotalMinor, "refundedMinor": group.RefundedMinor,
		"shippingMethod": orderGroupShippingMethod(group.ShippingMinor), "status": group.Status, "items": lines,
	}
	for key, value := range extra {
		data[key] = value
	}
	return data, nil
}

func orderItemVariantLabel(item *ent.OrderItem) string {
	if item.VariantTitle != "" {
		return item.VariantTitle
	}
	return strings.Join(nonEmpty(item.Size, item.Color), " · ")
}

func orderGroupShippingMethod(shippingMinor int64) string {
	if shippingMinor > 0 {
		return "Seller delivery"
	}
	return "Free seller delivery"
}
