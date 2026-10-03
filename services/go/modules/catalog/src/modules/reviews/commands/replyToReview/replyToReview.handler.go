package replytoreview

import (
	"context"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/events"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/review"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.SellerReviewView, error) {
	row, err := handler.Container.Client.Review.Query().Where(review.ID(command.ReviewId), review.StoreID(command.Store.StoreId)).Only(ctx)
	if ent.IsNotFound(err) {
		return types.SellerReviewView{}, catalogerrors.ReviewNotFound
	}
	if err != nil {
		return types.SellerReviewView{}, err
	}
	store, err := handler.Container.Client.Store.Get(ctx, command.Store.StoreId)
	if err != nil {
		return types.SellerReviewView{}, err
	}
	now := handler.Container.Now()
	var saved *ent.Review
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.Review.UpdateOneID(row.ID).SetReplyBody(command.Body).SetReplyAuthorName(store.Name)
		if row.ReplyCreatedAt == nil {
			update.SetReplyCreatedAt(now)
		} else {
			update.SetReplyUpdatedAt(now)
		}
		var saveError error
		if saved, saveError = update.Save(ctx); saveError != nil {
			return saveError
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "review.replied", row.ID.String(), now, map[string]any{
			"reviewId": row.ID, "storeId": row.StoreID, "authorAccountId": row.AuthorAccountID,
		})
	})
	if err != nil {
		return types.SellerReviewView{}, err
	}
	views, err := services.SellerReviewViews(ctx, handler.Container, []*ent.Review{saved})
	return views[0], err
}
