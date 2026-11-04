package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"

	"nantty/modules/orders/src/events"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/refundrecord"
)

const (
	RefundSourceManual       = "manual"
	RefundSourceSeller       = "seller"
	RefundSourceReturn       = "return"
	RefundSourceCancellation = "cancellation"
	RefundSourceDispute      = "dispute"
	RefundSourceSystem       = "system"
	RefundProcessing         = "processing"
	RefundScheduled          = "scheduled"
	RefundCompleted          = "completed"
)

type RefundRequestRecord struct {
	AmountMinor    int64
	Currency       string
	Reason         string
	EventReason    string
	Source         string
	CreatedById    string
	CreatedByName  string
	IdempotencyKey *string
	RequestHash    string
}

func EnqueueRefundRequest(ctx context.Context, tx *ent.Tx, group *ent.OrderGroup, request RefundRequestRecord, now time.Time) (*ent.RefundRecord, error) {
	record, err := tx.RefundRecord.Create().SetOrderGroupID(group.ID).SetStoreID(group.StoreID).SetBuyerAccountID(group.BuyerAccountID).SetOrderReference(group.Reference).
		SetAmountMinor(request.AmountMinor).SetCurrency(request.Currency).SetSource(request.Source).SetReason(truncateText(request.Reason, 1000)).
		SetCreatedByAccountID(request.CreatedById).SetCreatedByName(truncateText(request.CreatedByName, 80)).SetNillableIdempotencyKey(request.IdempotencyKey).
		SetRequestHash(request.RequestHash).Save(ctx)
	if err != nil {
		return nil, err
	}
	eventReason := request.EventReason
	if eventReason == "" {
		eventReason = request.Reason
	}
	return record, events.EnqueueOutboxEventInTransaction(ctx, tx, "orderGroup.refundRequested", group.ID.String(), now, map[string]any{
		"orderGroupId": group.ID, "storeId": group.StoreID, "buyerAccountId": group.BuyerAccountID, "amountMinor": request.AmountMinor, "currency": request.Currency, "reason": eventReason,
	})
}

func settleRefundRecords(ctx context.Context, tx *ent.Tx, group *ent.OrderGroup, refundedMinor int64, disputeId string, now time.Time) error {
	completedNow, err := tx.RefundRecord.Update().Where(refundrecord.OrderGroupID(group.ID), refundrecord.StatusIn(RefundProcessing, RefundScheduled)).
		SetStatus(RefundCompleted).SetCompletedAt(now).Save(ctx)
	if err != nil || completedNow > 0 {
		return err
	}
	source := RefundSourceSystem
	if disputeId != "" {
		source = RefundSourceDispute
	}
	amount := refundedMinor - group.RefundedMinor
	if amount <= 0 {
		return nil
	}
	return tx.RefundRecord.Create().SetOrderGroupID(group.ID).SetStoreID(group.StoreID).SetBuyerAccountID(group.BuyerAccountID).SetOrderReference(group.Reference).
		SetAmountMinor(amount).SetCurrency(group.Currency).SetSource(source).SetStatus(RefundCompleted).SetCompletedAt(now).Exec(ctx)
}

func RecordOrderRefundScheduled(ctx context.Context, deployed *container.Container, orderId uuid.UUID, amountMinor int64) error {
	return recordOrderRefundScheduled(ctx, deployed, orderId, amountMinor, "")
}

func RecordOrderRefundScheduledForEvent(ctx context.Context, deployed *container.Container, orderId uuid.UUID, amountMinor int64, envelopeID string) error {
	return recordOrderRefundScheduled(ctx, deployed, orderId, amountMinor, envelopeID)
}

func recordOrderRefundScheduled(ctx context.Context, deployed *container.Container, orderId uuid.UUID, amountMinor int64, envelopeID string) error {
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		claimed, err := claimProcessedMoneyEvent(ctx, tx, envelopeID, "escrow.refundScheduled")
		if err != nil || !claimed {
			return err
		}
		group, err := LockOrderGroup(ctx, tx, orderId)
		if err != nil {
			return err
		}
		updated, err := tx.RefundRecord.Update().Where(refundrecord.OrderGroupID(group.ID), refundrecord.Status(RefundProcessing)).SetStatus(RefundScheduled).Save(ctx)
		if err != nil {
			return err
		}
		if updated == 0 {
			return nil
		}
		summary := fmt.Sprintf("Refund of %d %s (minor units) scheduled; it completes automatically once the card payment settles", amountMinor, group.Currency)
		return AppendTimelineEvent(ctx, tx, group.ID, "refundScheduled", summary, SystemActor)
	})
}

func truncateText(text string, maximum int) string {
	runes := []rune(text)
	if len(runes) > maximum {
		return string(runes[:maximum])
	}
	return text
}

func actorIdText(actor OrderActor) string {
	if actor.AccountId == nil {
		return ""
	}
	return actor.AccountId.String()
}
