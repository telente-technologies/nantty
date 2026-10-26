package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	"nantty/modules/orders/src/generated/ent/storecreditentry"
)

func RecordOrderRefund(ctx context.Context, deployed *container.Container, orderId uuid.UUID, refundedMinor int64, disputeId string) error {
	return RecordSettledOrderRefund(ctx, deployed, orderId, refundedMinor, disputeId, false)
}

// RecordSettledOrderRefund marks the order refunded in full when escrow says nothing more is refundable,
// even if the amount is below the total because Zudomart kept its fees on a refund after the seller was paid.
func RecordSettledOrderRefund(ctx context.Context, deployed *container.Container, orderId uuid.UUID, refundedMinor int64, disputeId string, complete bool) error {
	released := false
	err := deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		group, err := LockOrderGroup(ctx, tx, orderId)
		if err != nil || refundedMinor <= group.RefundedMinor {
			return err
		}
		now := deployed.Now()
		if err := settleRefundRecords(ctx, tx, group, refundedMinor, disputeId, now); err != nil {
			return err
		}
		full := complete || refundedMinor >= group.TotalMinor
		paymentStatus := enums.PaymentPartiallyRefunded
		if full {
			paymentStatus = enums.PaymentRefunded
		}
		update := tx.OrderGroup.UpdateOneID(group.ID).SetRefundedMinor(min(refundedMinor, group.TotalMinor)).SetPaymentStatus(paymentStatus).AddVersion(1)
		if _, err := update.Save(ctx); err != nil {
			return err
		}
		summary := fmt.Sprintf("Refunded %d %s (minor units)", refundedMinor, group.Currency)
		if full && group.Status != enums.StatusCancelled && CanTransition(group.Status, enums.StatusRefunded) {
			released = group.StockReserved && (group.Status == enums.StatusNew || group.Status == enums.StatusProcessing || group.Status == enums.StatusReady)
			if group, err = TransitionOrderGroup(ctx, tx, group, Transition{To: enums.StatusRefunded, Summary: summary, Actor: SystemActor}, now); err != nil {
				return err
			}
		} else if err := AppendTimelineEvent(ctx, tx, group.ID, "refunded", summary, SystemActor); err != nil {
			return err
		}
		return settleCreditForRefund(ctx, tx, group, refundedMinor, full, now)
	})
	if err != nil {
		return err
	}
	if released {
		releaseReservedStockOrLeaveForSweep(ctx, deployed, orderId)
	}
	return nil
}

func settleCreditForRefund(ctx context.Context, tx *ent.Tx, group *ent.OrderGroup, refundedMinor int64, full bool, now time.Time) error {
	if full && group.StoreCreditMinor > 0 {
		expires := now.AddDate(0, 0, 180)
		if err := recordCredit(ctx, tx, creditMovement{StoreId: group.StoreID, BuyerId: group.BuyerAccountID, GroupId: &group.ID, Kind: enums.CreditRestore, AmountMinor: group.StoreCreditMinor,
			Currency: group.Currency, ExpiresAt: &expires, DedupeKey: "restore:" + group.ID.String(), EventType: "storeCredit.restored"}, now); err != nil {
			return err
		}
	}
	earned, err := tx.StoreCreditEntry.Query().Where(storecreditentry.DedupeKey("earn:" + group.ID.String())).Only(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	reversed, err := tx.StoreCreditEntry.Query().Where(storecreditentry.OrderGroupID(group.ID), storecreditentry.Kind(enums.CreditReverse)).All(ctx)
	if err != nil {
		return err
	}
	var alreadyReversed int64
	for _, row := range reversed {
		alreadyReversed += row.AmountMinor
	}
	state, err := CreditStateInTransaction(ctx, tx, group.StoreID, group.BuyerAccountID, now)
	if err != nil {
		return err
	}
	amount := ProportionalReversalMinor(earned.AmountMinor, alreadyReversed, refundedMinor, group.TotalMinor, state.BalanceMinor)
	return recordCredit(ctx, tx, creditMovement{StoreId: group.StoreID, BuyerId: group.BuyerAccountID, GroupId: &group.ID, Kind: enums.CreditReverse, AmountMinor: amount,
		Currency: group.Currency, DedupeKey: fmt.Sprintf("reverse:%s:%d", group.ID, refundedMinor), EventType: "storeCredit.reversed"}, now)
}

func MarkOrderDisputed(ctx context.Context, deployed *container.Container, orderId uuid.UUID, opened bool) error {
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		group, err := LockOrderGroup(ctx, tx, orderId)
		if err != nil {
			return err
		}
		now := deployed.Now()
		if opened {
			if group.Status == enums.StatusDisputed || !CanTransition(group.Status, enums.StatusDisputed) {
				return nil
			}
			_, err = TransitionOrderGroup(ctx, tx, group, Transition{To: enums.StatusDisputed, Summary: "A dispute was opened for this order", Actor: SystemActor}, now)
			return err
		}
		if group.Status != enums.StatusDisputed {
			return nil
		}
		restored := group.PreviousStatus
		if restored == "" || !CanTransition(enums.StatusDisputed, restored) {
			restored = enums.StatusNew
		}
		_, err = TransitionOrderGroup(ctx, tx, group, Transition{To: restored, Summary: "The dispute was closed", Kind: "note", Actor: SystemActor}, now)
		return err
	})
}

func RecordEscrowReleaseTime(ctx context.Context, deployed *container.Container, orderId uuid.UUID, releaseAt *time.Time) error {
	if releaseAt == nil {
		return nil
	}
	return deployed.Client.OrderGroup.Update().Where(ordergroup.ID(orderId), ordergroup.EscrowReleaseAtIsNil()).SetEscrowReleaseAt(releaseAt.UTC()).Exec(ctx)
}

func RecordEscrowReleaseRetry(ctx context.Context, deployed *container.Container, orderId uuid.UUID, retryAt *time.Time) error {
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		group, err := LockOrderGroup(ctx, tx, orderId)
		if err != nil {
			return err
		}
		if retryAt != nil {
			if err := tx.OrderGroup.UpdateOneID(group.ID).SetEscrowReleaseAt(retryAt.UTC()).AddVersion(1).Exec(ctx); err != nil {
				return err
			}
		}
		return AppendTimelineEvent(ctx, tx, group.ID, "sellerPayoutRetrying", "Paying the seller failed; Zudomart retries automatically", SystemActor)
	})
}
