package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/storecreditentry"
)

func creditEntryOf(row *ent.StoreCreditEntry) CreditEntry {
	return CreditEntry{Kind: row.Kind, AmountMinor: row.AmountMinor, ExpiresAt: row.ExpiresAt, CreatedAt: row.CreatedAt}
}

func LoadCreditStatesForBuyer(ctx context.Context, client *ent.Client, buyerId uuid.UUID, storeIds []uuid.UUID, now time.Time) (map[uuid.UUID]CreditState, error) {
	query := client.StoreCreditEntry.Query().Where(storecreditentry.BuyerAccountID(buyerId))
	if storeIds != nil {
		query = query.Where(storecreditentry.StoreIDIn(storeIds...))
	}
	rows, err := query.Order(ent.Asc(storecreditentry.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	byStore := map[uuid.UUID][]CreditEntry{}
	for _, row := range rows {
		byStore[row.StoreID] = append(byStore[row.StoreID], creditEntryOf(row))
	}
	states := map[uuid.UUID]CreditState{}
	for storeId, entries := range byStore {
		states[storeId] = ComputeCreditState(entries, now)
	}
	return states, nil
}

func CreditStateInTransaction(ctx context.Context, tx *ent.Tx, storeId, buyerId uuid.UUID, now time.Time) (CreditState, error) {
	rows, err := tx.StoreCreditEntry.Query().Where(storecreditentry.StoreID(storeId), storecreditentry.BuyerAccountID(buyerId)).Order(ent.Asc(storecreditentry.FieldID)).All(ctx)
	if err != nil {
		return CreditState{}, err
	}
	entries := make([]CreditEntry, 0, len(rows))
	for _, row := range rows {
		entries = append(entries, creditEntryOf(row))
	}
	return ComputeCreditState(entries, now), nil
}

func LoadStoreCreditStates(ctx context.Context, deployed *container.Container, storeId uuid.UUID) (map[uuid.UUID]CreditState, error) {
	rows, err := deployed.Client.StoreCreditEntry.Query().Where(storecreditentry.StoreID(storeId)).Order(ent.Asc(storecreditentry.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	byBuyer := map[uuid.UUID][]CreditEntry{}
	for _, row := range rows {
		byBuyer[row.BuyerAccountID] = append(byBuyer[row.BuyerAccountID], creditEntryOf(row))
	}
	states := map[uuid.UUID]CreditState{}
	for buyerId, entries := range byBuyer {
		states[buyerId] = ComputeCreditState(entries, deployed.Now())
	}
	return states, nil
}
