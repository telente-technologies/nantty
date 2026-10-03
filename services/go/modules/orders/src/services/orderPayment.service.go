package services

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/enums"
	"zudomart/modules/orders/src/events"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/checkout"
	"zudomart/modules/orders/src/generated/ent/ordergroup"
	"zudomart/modules/orders/src/generated/ent/orderitem"
	"zudomart/platform/commerceports"
	"zudomart/platform/httpserver"
)

func RecordOrderPaid(ctx context.Context, deployed *container.Container, orderId uuid.UUID) error {
	group, err := deployed.Client.OrderGroup.Get(ctx, orderId)
	if err != nil {
		return err
	}
	if group.StockReserved && group.Status == enums.StatusPending {
		if err := confirmStockReservation(ctx, deployed, group); err != nil {
			return err
		}
	}
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		locked, err := LockOrderGroup(ctx, tx, orderId)
		if err != nil {
			return err
		}
		now := deployed.Now()
		switch locked.Status {
		case enums.StatusPending:
			return markGroupPaid(ctx, deployed, tx, locked, now)
		case enums.StatusCancelled:
			if locked.PaymentStatus == enums.PaymentPaid {
				return nil
			}
			if err := tx.OrderGroup.UpdateOneID(locked.ID).SetPaymentStatus(enums.PaymentPaid).SetPaidAt(now).SetRefundRequestedAt(now).Exec(ctx); err != nil {
				return err
			}
			if err := AppendTimelineEvent(ctx, tx, locked.ID, "note", "Payment arrived after the order was cancelled; a refund was requested", SystemActor); err != nil {
				return err
			}
			return events.EnqueueOutboxEventInTransaction(ctx, tx, "orderGroup.refundRequested", locked.ID.String(), now, map[string]any{
				"orderGroupId": locked.ID, "storeId": locked.StoreID, "buyerAccountId": locked.BuyerAccountID, "amountMinor": locked.TotalMinor, "currency": locked.Currency, "reason": "paid after cancellation",
			})
		}
		return nil
	})
}

func confirmStockReservation(ctx context.Context, deployed *container.Container, group *ent.OrderGroup) error {
	stock, err := deployed.Stock()
	if err != nil {
		return err
	}
	err = stock.Confirm(ctx, group.ID.String())
	if err == nil || !isReservationLost(err) {
		return err
	}
	items, loadError := deployed.Client.OrderItem.Query().Where(orderitem.OrderGroupID(group.ID), orderitem.TracksStock(true)).All(ctx)
	if loadError != nil {
		return loadError
	}
	lines := make([]commerceports.StockLine, 0, len(items))
	for _, item := range items {
		lines = append(lines, commerceports.StockLine{VariantId: item.VariantID, StoreId: item.StoreID, Quantity: item.Quantity})
	}
	if reserveError := stock.Reserve(ctx, commerceports.ReserveStockRequest{Reference: group.ID.String(), Lines: lines}); reserveError != nil {
		var shortage commerceports.InsufficientStockError
		if errors.As(reserveError, &shortage) {
			return nil
		}
		return reserveError
	}
	return nil
}

func isReservationLost(err error) bool {
	var apiError *httpserver.ApiError
	return errors.As(err, &apiError) && (apiError.Code == "RESERVATION_NOT_ACTIVE" || apiError.Code == "NOTHING_RESERVED")
}

func markGroupPaid(ctx context.Context, deployed *container.Container, tx *ent.Tx, group *ent.OrderGroup, now time.Time) error {
	paid, err := TransitionOrderGroup(ctx, tx, group, Transition{To: enums.StatusNew, Summary: "Payment received. The money is held in escrow until delivery.", Kind: "paid", Actor: SystemActor,
		Customize: func(update *ent.OrderGroupUpdateOne) { update.SetPaymentStatus(enums.PaymentPaid).SetPaidAt(now) }}, now)
	if err != nil {
		return err
	}
	pending, err := tx.OrderGroup.Query().Where(ordergroup.CheckoutID(group.CheckoutID), ordergroup.Status(enums.StatusPending)).Exist(ctx)
	if err != nil {
		return err
	}
	if !pending {
		if err := tx.Checkout.Update().Where(checkout.ID(group.CheckoutID)).SetStatus(enums.CheckoutPaid).Exec(ctx); err != nil {
			return err
		}
	}
	if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "orderGroup.paid", group.ID.String(), now, map[string]any{
		"orderGroupId": group.ID, "checkoutId": group.CheckoutID, "storeId": group.StoreID, "buyerAccountId": group.BuyerAccountID, "totalMinor": group.TotalMinor, "currency": group.Currency,
	}); err != nil {
		return err
	}
	return enqueuePurchaseInteractions(ctx, deployed, tx, paid, now)
}

func enqueuePurchaseInteractions(ctx context.Context, deployed *container.Container, tx *ent.Tx, group *ent.OrderGroup, now time.Time) error {
	choices, found, err := deployed.Users.PrivacyChoicesOf(ctx, group.BuyerAccountID)
	if err != nil || !found || !choices.Analytics {
		return err
	}
	items, err := tx.OrderItem.Query().Where(orderitem.OrderGroupID(group.ID)).All(ctx)
	if err != nil {
		return err
	}
	for _, item := range items {
		data := map[string]any{
			"occurredAt": now.UTC().Format(time.RFC3339Nano), "productId": item.ProductID, "storeId": item.StoreID, "variantId": item.VariantID,
			"quantity": item.Quantity, "personalized": choices.Personalization, "orderGroupId": group.ID,
		}
		if choices.Personalization {
			data["actorId"] = group.BuyerAccountID
		}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "product.purchased", item.ProductID.String(), now, data); err != nil {
			return err
		}
	}
	return nil
}
