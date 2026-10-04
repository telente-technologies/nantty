package services

import (
	"context"
	"time"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/storevisitor"
)

var storeVisitEvents = map[string]bool{"product.viewed": true, "product.clicked": true, "seller.viewed": true, "product.addedToCart": true}

func visitedStoreOf(ctx context.Context, tx *ent.Tx, data map[string]any) (uuid.UUID, bool) {
	if raw, found := data["storeId"].(string); found {
		if storeId, err := uuid.Parse(raw); err == nil {
			return storeId, true
		}
	}
	raw, found := data["productId"].(string)
	if !found {
		return uuid.Nil, false
	}
	productId, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, false
	}
	parent, err := tx.Product.Get(ctx, productId)
	if err != nil {
		return uuid.Nil, false
	}
	return parent.StoreID, true
}

func RecordStoreVisitWhenPersonalized(ctx context.Context, tx *ent.Tx, event string, data map[string]any, occurredAt time.Time) error {
	rawActor, personalized := data["actorId"].(string)
	if !personalized || !storeVisitEvents[event] {
		return nil
	}
	accountId, err := uuid.Parse(rawActor)
	if err != nil {
		return nil
	}
	storeId, found := visitedStoreOf(ctx, tx, data)
	if !found {
		return nil
	}
	return tx.StoreVisitor.Create().SetStoreID(storeId).SetAccountID(accountId).SetLastVisitedAt(occurredAt).
		OnConflict(sql.ConflictColumns(storevisitor.FieldStoreID, storevisitor.FieldAccountID)).
		Update(func(upsert *ent.StoreVisitorUpsert) {
			upsert.AddVisitCount(1).SetLastVisitedAt(occurredAt)
		}).Exec(ctx)
}
