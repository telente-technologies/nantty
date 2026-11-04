package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/enums"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/events"
	"nantty/modules/orders/src/generated/ent"
)

type ShipmentPatch struct {
	RiderName           *string
	RiderPhone          *string
	EstimatedDeliveryAt *time.Time
	Retry               bool
}

func UpdateShipmentDetails(ctx context.Context, deployed *container.Container, seller SellerContext, orderId uuid.UUID, patch ShipmentPatch) error {
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		group, err := lockStoreOrder(ctx, tx, seller.Store.StoreId, orderId)
		if err != nil {
			return err
		}
		update := tx.OrderGroup.UpdateOneID(group.ID).AddVersion(1)
		if patch.RiderName != nil {
			setOrClear(*patch.RiderName, update.SetRiderName, update.ClearRiderName)
		}
		if patch.RiderPhone != nil {
			setOrClear(*patch.RiderPhone, update.SetRiderPhone, update.ClearRiderPhone)
		}
		if patch.EstimatedDeliveryAt != nil {
			update.SetEstimatedDeliveryAt(*patch.EstimatedDeliveryAt)
		}
		if patch.Retry && group.Status == enums.StatusShipped && group.DeliveryStatus == "failed" {
			update.SetDeliveryStatus("in_transit")
		}
		return update.Exec(ctx)
	})
}

func setOrClear(value string, set func(string) *ent.OrderGroupUpdateOne, clear func() *ent.OrderGroupUpdateOne) {
	if value == "" {
		clear()
		return
	}
	set(value)
}

func RecordFailedDeliveryAttempt(ctx context.Context, deployed *container.Container, seller SellerContext, orderId uuid.UUID, note string) error {
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		group, err := lockStoreOrder(ctx, tx, seller.Store.StoreId, orderId)
		if err != nil {
			return err
		}
		if group.Status != enums.StatusShipped {
			return ordererrors.NotInTransit
		}
		updated, err := tx.OrderGroup.UpdateOneID(group.ID).SetDeliveryStatus("failed").AddDeliveryAttempts(1).SetLastAttemptNote(note).AddVersion(1).Save(ctx)
		if err != nil {
			return err
		}
		if err := AppendTimelineEvent(ctx, tx, group.ID, "delivery_failed", "Delivery attempt failed: "+note, seller.actor()); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "orderGroup.deliveryAttemptFailed", group.ID.String(), time.Now().UTC(), map[string]any{
			"orderGroupId": group.ID, "storeId": group.StoreID, "buyerAccountId": group.BuyerAccountID,
			"sellerAccountId": group.SellerAccountID, "reference": group.Reference, "attempts": updated.DeliveryAttempts,
			"actorKind": seller.actor().Kind,
		})
	})
}

func AddOrderNoteAndTimeline(ctx context.Context, deployed *container.Container, seller SellerContext, orderId uuid.UUID, body string) error {
	if err := AddOrderNote(ctx, deployed, seller, orderId, body); err != nil {
		return err
	}
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		return AppendTimelineEvent(ctx, tx, orderId, "note", "Internal note added", seller.actor())
	})
}
