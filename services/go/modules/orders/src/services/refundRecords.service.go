package services

import (
	"context"
	"time"

	"zudomart/modules/orders/src/events"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/refundrecord"
)

const (
	RefundSourceManual       = "manual"
	RefundSourceSeller       = "seller"
	RefundSourceReturn       = "return"
	RefundSourceCancellation = "cancellation"
	RefundSourceDispute      = "dispute"
	RefundSourceSystem       = "system"
	RefundProcessing         = "processing"
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
	completedNow, err := tx.RefundRecord.Update().Where(refundrecord.OrderGroupID(group.ID), refundrecord.Status(RefundProcessing)).
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
