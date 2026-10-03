package removereviewreply

import (
	"context"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
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
	saved, err := row.Update().ClearReplyBody().ClearReplyAuthorName().ClearReplyCreatedAt().ClearReplyUpdatedAt().Save(ctx)
	if err != nil {
		return types.SellerReviewView{}, err
	}
	views, err := services.SellerReviewViews(ctx, handler.Container, []*ent.Review{saved})
	return views[0], err
}
