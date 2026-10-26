package services

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/events"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/checkout"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	"nantty/modules/orders/src/generated/ent/orderitem"
	"nantty/platform/commerceports"
	"nantty/platform/httpserver"
)

func RecordOrderPaid(ctx context.Context, deployed *container.Container, orderId uuid.UUID) error {
	group, err := deployed.Client.OrderGroup.Get(ctx, orderId)
	if err != nil {
		return err
	}
	stockShort := false
	if group.StockReserved && group.Status == enums.StatusPending {
		err := confirmStockReservation(ctx, deployed, group)
		var shortage commerceports.InsufficientStockError
		if asInsufficientStock(err, &shortage) {
			stockShort = true
		} else if err != nil {
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
			if stockShort {
				return cancelPaidOrderWithoutStock(ctx, tx, locked, now)
			}
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
			_, err := EnqueueRefundRequest(ctx, tx, locked, RefundRequestRecord{AmountMinor: locked.TotalMinor, Currency: locked.Currency, Reason: "paid after cancellation", Source: RefundSourceCancellation}, now)
			return err
		}
		return nil
	})
}

const outOfStockReason = "paid but an item sold out"

func cancelPaidOrderWithoutStock(ctx context.Context, tx *ent.Tx, group *ent.OrderGroup, now time.Time) error {
	if _, err := TransitionOrderGroup(ctx, tx, group, Transition{To: enums.StatusCancelled, Kind: "cancelled", Summary: "Payment received but an item sold out; the payment is being refunded", Actor: SystemActor,
		Customize: func(update *ent.OrderGroupUpdateOne) {
			update.SetCancelReason(outOfStockReason).SetPaymentStatus(enums.PaymentPaid).SetPaidAt(now).SetRefundRequestedAt(now)
		}}, now); err != nil {
		return err
	}
	if err := restoreStoreCreditOfCancelledGroup(ctx, tx, group, now); err != nil {
		return err
	}
	if err := markCheckoutPaidWhenNoGroupPending(ctx, tx, group.CheckoutID); err != nil {
		return err
	}
	_, err := EnqueueRefundRequest(ctx, tx, group, RefundRequestRecord{AmountMinor: group.TotalMinor, Currency: group.Currency, Reason: outOfStockReason, Source: RefundSourceSystem}, now)
	return err
}

func markCheckoutPaidWhenNoGroupPending(ctx context.Context, tx *ent.Tx, checkoutId uuid.UUID) error {
	pending, err := tx.OrderGroup.Query().Where(ordergroup.CheckoutID(checkoutId), ordergroup.Status(enums.StatusPending)).Exist(ctx)
	if err != nil || pending {
		return err
	}
	return tx.Checkout.Update().Where(checkout.ID(checkoutId)).SetStatus(enums.CheckoutPaid).Exec(ctx)
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
	if err := markCheckoutPaidWhenNoGroupPending(ctx, tx, group.CheckoutID); err != nil {
		return err
	}
	attributed, err := loadAttributedSaleItems(ctx, tx, group)
	if err != nil {
		return err
	}
	payload, err := OrderGroupEventData(ctx, tx, paid, map[string]any{
		"orderedAt": group.CreatedAt.UTC().Format(time.RFC3339Nano), "paidAt": now.UTC().Format(time.RFC3339Nano), "attributedItems": attributed,
	})
	if err != nil {
		return err
	}
	if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "orderGroup.paid", group.ID.String(), now, payload); err != nil {
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
			"unitPrice": map[string]any{"amountMinor": item.UnitPriceMinor, "currency": group.Currency},
		}
		if item.AttributionSource != nil && *item.AttributionSource == "post" && item.AttributionID != nil {
			data["sourcePostId"] = item.AttributionID.String()
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
