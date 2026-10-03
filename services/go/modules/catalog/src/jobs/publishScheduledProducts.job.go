package jobs

import (
	"context"
	"log/slog"
	"time"

	"entgo.io/ent/dialect/sql"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	"zudomart/modules/catalog/src/events"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/product"
	"zudomart/modules/catalog/src/generated/ent/productmedia"
)

func PublishDueScheduledProducts(ctx context.Context, deployed *container.Container, batch int) (int, error) {
	published := 0
	err := deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		published = 0
		now := deployed.Now()
		due, err := tx.Product.Query().Where(product.Status(enums.ProductDraft), product.PublishAtLTE(now)).
			Order(ent.Asc(product.FieldPublishAt)).Limit(batch).ForUpdate(sql.WithLockAction(sql.SkipLocked)).All(ctx)
		if err != nil {
			return err
		}
		for _, row := range due {
			hasImage, err := tx.ProductMedia.Query().Where(productmedia.ProductID(row.ID)).Exist(ctx)
			if err != nil {
				return err
			}
			if err := row.Update().SetStatus(enums.ProductActive).SetPublishedOnline(hasImage).SetPublishedAt(now).ClearPublishAt().Exec(ctx); err != nil {
				return err
			}
			if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "product.published", row.ID.String(), now, map[string]any{
				"productId": row.ID, "storeId": row.StoreID, "scheduled": true, "listed": hasImage,
			}); err != nil {
				return err
			}
			published++
		}
		return nil
	})
	return published, err
}

func RunScheduledPublishingUntilContextDone(ctx context.Context, deployed *container.Container) {
	ticker := time.NewTicker(deployed.Settings.ScheduledPublishPeriod)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := PublishDueScheduledProducts(ctx, deployed, 100); err != nil && ctx.Err() == nil {
				deployed.Logger.WarnContext(ctx, "scheduled publishing failed", slog.Any("error", err))
			}
		}
	}
}
