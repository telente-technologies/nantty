package services

import (
	"context"
	"time"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/productdailyview"
	"nantty/modules/catalog/src/generated/ent/storedailytraffic"
	"nantty/modules/catalog/src/generated/ent/storevisitor"
)

var trafficEvents = map[string]bool{"product.viewed": true, "seller.viewed": true}

func RecordStoreTrafficInTransaction(ctx context.Context, tx *ent.Tx, event string, data map[string]any, occurredAt time.Time) error {
	if !trafficEvents[event] {
		return nil
	}
	storeId, found := visitedStoreOf(ctx, tx, data)
	if !found {
		return nil
	}
	moment := occurredAt.UTC()
	day := moment.Format(time.DateOnly)
	visitors := 0
	if raw, personalized := data["actorId"].(string); personalized {
		if accountId, err := uuid.Parse(raw); err == nil {
			dayStart := time.Date(moment.Year(), moment.Month(), moment.Day(), 0, 0, 0, 0, time.UTC)
			seenToday, err := tx.StoreVisitor.Query().Where(storevisitor.StoreID(storeId), storevisitor.AccountID(accountId), storevisitor.LastVisitedAtGTE(dayStart)).Exist(ctx)
			if err != nil {
				return err
			}
			if !seenToday {
				visitors = 1
			}
		}
	} else if event == "seller.viewed" {
		visitors = 1
	}
	productViews := 0
	var productId *uuid.UUID
	if event == "product.viewed" {
		if parsed, err := uuid.Parse(stringValue(data["productId"])); err == nil {
			productId, productViews = &parsed, 1
		}
	}
	err := tx.StoreDailyTraffic.Create().SetStoreID(storeId).SetDay(day).SetStoreViews(1).SetProductViews(productViews).SetVisitors(visitors).
		OnConflict(sql.ConflictColumns(storedailytraffic.FieldStoreID, storedailytraffic.FieldDay)).
		Update(func(upsert *ent.StoreDailyTrafficUpsert) {
			upsert.AddStoreViews(1).AddProductViews(productViews).AddVisitors(visitors)
		}).Exec(ctx)
	if err != nil || productId == nil {
		return err
	}
	return tx.ProductDailyView.Create().SetStoreID(storeId).SetProductID(*productId).SetDay(day).SetViews(1).
		OnConflict(sql.ConflictColumns(productdailyview.FieldProductID, productdailyview.FieldDay)).
		Update(func(upsert *ent.ProductDailyViewUpsert) { upsert.AddViews(1) }).Exec(ctx)
}

func stringValue(value any) string {
	text, _ := value.(string)
	return text
}
