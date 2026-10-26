package deletereview

import (
	"context"

	"nantty/modules/catalog/src/container"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/events"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/review"
)

type Handler struct {
	Container *container.Container
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
			if err := tx.Product.UpdateOneID(*row.ProductID).AddRatingSum(-int64(row.Rating)).AddRatingCount(-1).Exec(ctx); err != nil {
				return err
			}
		}
		if err := tx.Store.UpdateOneID(row.StoreID).AddRatingSum(-int64(row.Rating)).AddRatingCount(-1).Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "review.deleted", row.ID.String(), handler.Container.Now(), map[string]any{
			"reviewId": row.ID, "storeId": row.StoreID, "productId": row.ProductID, "rating": row.Rating, "authorAccountId": row.AuthorAccountID,
		})
	})
}
