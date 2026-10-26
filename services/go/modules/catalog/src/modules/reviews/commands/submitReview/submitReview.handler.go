package submitreview

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/enums"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/events"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/types"
	"nantty/platform/commerceports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.PublicReviewView, error) {
	storeId, kind, orderNumber, err := handler.verifyPurchase(ctx, command)
	if err != nil {
		return types.PublicReviewView{}, err
	}
	var created *ent.Review
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		create := tx.Review.Create().SetKind(kind).SetStoreID(storeId).SetAuthorAccountID(command.AccountId).SetOrderNumber(orderNumber).SetVerifiedPurchase(true).
			SetRating(command.Request.Rating).SetBody(command.Request.Text).SetNillableTitle(command.Request.Title)
		if command.ProductId != nil {
			create.SetProductID(*command.ProductId)
		}
		var createError error
		if created, createError = create.Save(ctx); createError != nil {
			return createError
		}
		if command.ProductId != nil {
			if err := tx.Product.UpdateOneID(*command.ProductId).AddRatingSum(int64(created.Rating)).AddRatingCount(1).Exec(ctx); err != nil {
				return err
			}
		}
		store, err := tx.Store.UpdateOneID(storeId).AddRatingSum(int64(created.Rating)).AddRatingCount(1).Save(ctx)
		if err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "review.created", created.ID.String(), handler.Container.Now(), map[string]any{
			"reviewId": created.ID, "storeId": storeId, "productId": command.ProductId, "rating": created.Rating, "authorAccountId": command.AccountId,
			"storeOwnerAccountId": store.OwnerAccountID, "storeName": store.Name,
		})
	})
	if ent.IsConstraintError(err) {
		return types.PublicReviewView{}, catalogerrors.AlreadyReviewed
	}
	if err != nil {
		return types.PublicReviewView{}, err
	}
	return services.PublicReviewViews(ctx, handler.Container, []*ent.Review{created})[0], nil
}

func (handler Handler) verifyPurchase(ctx context.Context, command Command) (uuid.UUID, string, string, error) {
	verifier, err := commerceports.Default.PurchaseVerifier()
	if err != nil {
		return uuid.Nil, "", "", catalogerrors.ReviewNeedsPurchase
	}
	if command.ProductId != nil {
		row, err := handler.Container.Client.Product.Get(ctx, *command.ProductId)
		if ent.IsNotFound(err) {
			return uuid.Nil, "", "", catalogerrors.ProductNotFound
		}
		if err != nil {
			return uuid.Nil, "", "", err
		}
		orderNumber, found, err := verifier.FindReceivedPurchaseOfProduct(ctx, command.AccountId, row.ID)
		if err != nil || !found {
			return uuid.Nil, "", "", firstError(err, catalogerrors.ReviewNeedsPurchase)
		}
		return row.StoreID, enums.ReviewKindProduct, orderNumber, nil
	}
	orderNumber, found, err := verifier.FindReceivedPurchaseFromStore(ctx, command.AccountId, *command.StoreId)
	if err != nil || !found {
		return uuid.Nil, "", "", firstError(err, catalogerrors.ReviewNeedsPurchase)
	}
	return *command.StoreId, enums.ReviewKindStore, orderNumber, nil
}

func firstError(primary, fallback error) error {
	if primary != nil {
		return primary
	}
	return fallback
}
