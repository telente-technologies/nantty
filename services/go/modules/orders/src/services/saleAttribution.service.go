package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/events"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/orderitem"
)

type AttributedSaleItem struct {
	OrderItemId       uuid.UUID  `json:"orderItemId"`
	ProductId         uuid.UUID  `json:"productId"`
	VariantId         uuid.UUID  `json:"variantId"`
	Quantity          int        `json:"quantity"`
	LineTotalMinor    int64      `json:"lineTotalMinor"`
	Currency          string     `json:"currency"`
	AttributionSource string     `json:"attributionSource"`
	AttributionId     uuid.UUID  `json:"attributionId"`
	AttributedAt      *time.Time `json:"attributedAt"`
	CommissionBps     *int64     `json:"commissionBasisPoints"`
}

func AttributedSaleItemsOf(group *ent.OrderGroup, items []*ent.OrderItem) []AttributedSaleItem {
	attributed := []AttributedSaleItem{}
	for _, item := range items {
		if item.AttributionSource == nil || item.AttributionID == nil {
			continue
		}
		attributed = append(attributed, AttributedSaleItem{OrderItemId: item.ID, ProductId: item.ProductID, VariantId: item.VariantID, Quantity: item.Quantity,
			LineTotalMinor: item.LineTotalMinor, Currency: group.Currency, AttributionSource: *item.AttributionSource, AttributionId: *item.AttributionID,
			AttributedAt: item.AttributedAt, CommissionBps: item.AffiliateCommissionBps})
	}
	return attributed
}

func loadAttributedSaleItems(ctx context.Context, tx *ent.Tx, group *ent.OrderGroup) ([]AttributedSaleItem, error) {
	items, err := tx.OrderItem.Query().Where(orderitem.OrderGroupID(group.ID), orderitem.AttributionSourceNotNil()).All(ctx)
	if err != nil {
		return nil, err
	}
	return AttributedSaleItemsOf(group, items), nil
}

func enqueueOrderCompleted(ctx context.Context, tx *ent.Tx, group *ent.OrderGroup, now time.Time) error {
	attributed, err := loadAttributedSaleItems(ctx, tx, group)
	if err != nil {
		return err
	}
	payload, err := OrderGroupEventData(ctx, tx, group, map[string]any{
		"orderedAt": group.CreatedAt.UTC().Format(time.RFC3339Nano), "completedAt": now.UTC().Format(time.RFC3339Nano), "attributedItems": attributed,
	})
	if err != nil {
		return err
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, "orderGroup.completed", group.ID.String(), now, payload)
}
