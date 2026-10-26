package reportreview

import (
	"context"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/enums"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/events"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/review"
	"nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.SellerReviewView, error) {
	var saved *ent.Review
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.Review.Query().Where(review.ID(command.ReviewId), review.StoreID(command.Store.StoreId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return catalogerrors.ReviewNotFound
		}
		if err != nil {
			return err
		}
		if row.Status == enums.ReviewReported {
			return catalogerrors.AlreadyReported
		}
		if saved, err = row.Update().SetStatus(enums.ReviewReported).SetReportReason(command.Request.Reason).SetNillableReportDetails(command.Request.Details).Save(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "review.reported", row.ID.String(), handler.Container.Now(), map[string]any{
			"reviewId": row.ID, "storeId": row.StoreID, "reason": command.Request.Reason,
		})
	})
	if err != nil {
		return types.SellerReviewView{}, err
	}
	views, err := services.SellerReviewViews(ctx, handler.Container, []*ent.Review{saved})
	return views[0], err
}
