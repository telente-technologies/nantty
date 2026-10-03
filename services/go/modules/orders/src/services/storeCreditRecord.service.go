package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/events"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/storecreditentry"
)

type creditMovement struct {
	StoreId     uuid.UUID
	BuyerId     uuid.UUID
	GroupId     *uuid.UUID
	Kind        string
	AmountMinor int64
	Currency    string
	ExpiresAt   *time.Time
	DedupeKey   string
	EventType   string
}

func recordCredit(ctx context.Context, tx *ent.Tx, movement creditMovement, now time.Time) error {
	if movement.AmountMinor <= 0 {
		return nil
	}
	exists, err := tx.StoreCreditEntry.Query().Where(storecreditentry.DedupeKey(movement.DedupeKey)).Exist(ctx)
	if err != nil || exists {
		return err
	}
	create := tx.StoreCreditEntry.Create().SetStoreID(movement.StoreId).SetBuyerAccountID(movement.BuyerId).SetKind(movement.Kind).SetAmountMinor(movement.AmountMinor).
		SetCurrency(movement.Currency).SetDedupeKey(movement.DedupeKey).SetNillableExpiresAt(movement.ExpiresAt).SetNillableOrderGroupID(movement.GroupId)
	if err := create.Exec(ctx); err != nil {
		return err
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, movement.EventType, movement.StoreId.String(), now, map[string]any{
		"storeId": movement.StoreId, "buyerAccountId": movement.BuyerId, "orderGroupId": movement.GroupId, "amountMinor": movement.AmountMinor, "currency": movement.Currency,
	})
}
