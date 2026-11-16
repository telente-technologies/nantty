package deletereview

import (
	"context"

	"nantty/modules/catalog/src/container"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/events"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/product"
	"nantty/modules/catalog/src/generated/ent/review"
	"nantty/modules/catalog/src/generated/ent/store"
)

type Handler struct {
	Container *container.Container
}

func DecrementRatingTotals(currentSum int64, currentCount int, rating int) (int64, int) {
	return max(currentSum-int64(rating), 0), max(currentCount-1, 0)
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.Review.Query().Where(review.ID(command.ReviewId), review.AuthorAccountID(command.AccountId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return catalogerrors.ReviewNotYours
		}
		if err != nil {
			return err
		}
		if err := tx.Review.DeleteOne(row).Exec(ctx); err != nil {
			return err
		}
		if row.ProductID != nil {
			item, err := tx.Product.Query().Where(product.ID(*row.ProductID)).ForUpdate().Only(ctx)
			if err != nil {
				return err
			}
			nextSum, nextCount := DecrementRatingTotals(item.RatingSum, item.RatingCount, row.Rating)
			if err := tx.Product.UpdateOneID(item.ID).SetRatingSum(nextSum).SetRatingCount(nextCount).Exec(ctx); err != nil {
				return err
			}
		}
		sellerStore, err := tx.Store.Query().Where(store.ID(row.StoreID)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		nextStoreSum, nextStoreCount := DecrementRatingTotals(sellerStore.RatingSum, sellerStore.RatingCount, row.Rating)
		if err := tx.Store.UpdateOneID(sellerStore.ID).SetRatingSum(nextStoreSum).SetRatingCount(nextStoreCount).Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "review.deleted", row.ID.String(), handler.Container.Now(), map[string]any{
			"reviewId": row.ID, "storeId": row.StoreID, "productId": row.ProductID, "rating": row.Rating, "authorAccountId": row.AuthorAccountID,
		})
	})
}
