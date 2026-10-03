package services

import (
	"context"
	"errors"
	"time"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/enums"
	"zudomart/modules/orders/src/events"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/checkout"
	"zudomart/modules/orders/src/generated/ent/ordergroup"
	"zudomart/modules/orders/src/generated/ent/storerewardsettings"
	"zudomart/platform/commerceports"

	"github.com/google/uuid"
)

func asInsufficientStock(err error, target *commerceports.InsufficientStockError) bool {
	return errors.As(err, target)
}

func AbortCheckout(ctx context.Context, deployed *container.Container, checkoutId uuid.UUID, finalStatus, reason string) error {
	released := []string{}
	err := deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.Checkout.Query().Where(checkout.ID(checkoutId)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if row.Status != enums.CheckoutRegistering && row.Status != enums.CheckoutPayable {
			return nil
		}
		groups, err := tx.OrderGroup.Query().Where(ordergroup.CheckoutID(checkoutId), ordergroup.Status(enums.StatusPending)).ForUpdate().All(ctx)
		if err != nil {
			return err
		}
		now := deployed.Now()
		for _, group := range groups {
			if err := cancelPendingGroup(ctx, tx, group, reason, now); err != nil {
				return err
			}
			if group.StockReserved {
				released = append(released, group.ID.String())
			}
		}
		if err := row.Update().SetStatus(finalStatus).Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "order.cancelled", checkoutId.String(), now, map[string]any{"checkoutId": checkoutId, "reason": reason, "status": finalStatus})
	})
	if err != nil {
		return err
	}
	stock, stockError := deployed.Stock()
	if stockError != nil {
		return nil
	}
	for _, reference := range released {
		if err := stock.Release(context.WithoutCancel(ctx), reference); err != nil {
			return err
		}
	}
	return nil
}

func cancelPendingGroup(ctx context.Context, tx *ent.Tx, group *ent.OrderGroup, reason string, now time.Time) error {
	if _, err := TransitionOrderGroup(ctx, tx, group, Transition{To: enums.StatusCancelled, Summary: reason, Actor: SystemActor, Customize: func(update *ent.OrderGroupUpdateOne) {
		update.SetCancelReason(reason).SetPaymentStatus(enums.PaymentPending)
	}}, now); err != nil {
		return err
	}
	if group.StoreCreditMinor == 0 {
		return nil
	}
	expiryDays := 180
	if settings, err := tx.StoreRewardSettings.Query().Where(storerewardsettings.StoreID(group.StoreID)).Only(ctx); err == nil {
		expiryDays = settings.ExpiryDays
	}
	expires := now.AddDate(0, 0, expiryDays)
	return recordCredit(ctx, tx, creditMovement{StoreId: group.StoreID, BuyerId: group.BuyerAccountID, GroupId: &group.ID, Kind: enums.CreditRestore, AmountMinor: group.StoreCreditMinor,
		Currency: group.Currency, ExpiresAt: &expires, DedupeKey: "restore:" + group.ID.String(), EventType: "storeCredit.restored"}, now)
}
