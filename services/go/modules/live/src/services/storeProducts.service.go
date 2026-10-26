package services

import (
	"context"

	"github.com/google/uuid"

	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/interfaces"
)

const draftProductStatus = "draft"

func (service *LiveService) requireStoreMember(ctx context.Context, storeId, userId uuid.UUID) error {
	member, err := service.Catalog.IsStoreMember(ctx, storeId, userId)
	if err != nil {
		service.Logger.WarnContext(ctx, "store membership check failed", "error", err)
		return liveerrors.CatalogUnavailable
	}
	if !member {
		return liveerrors.NotStoreMember
	}
	return nil
}

func (service *LiveService) requireStoreProducts(ctx context.Context, storeId uuid.UUID, productIds []uuid.UUID, onScreen bool) (map[uuid.UUID]interfaces.StoreProduct, error) {
	owned, err := service.Catalog.OwnedProducts(ctx, storeId, productIds)
	if err != nil {
		service.Logger.WarnContext(ctx, "product ownership check failed", "error", err)
		return nil, liveerrors.CatalogUnavailable
	}
	for _, productId := range productIds {
		product, found := owned[productId]
		if !found {
			return nil, liveerrors.ProductNotInStore
		}
		if onScreen && product.Status == draftProductStatus {
			return nil, liveerrors.ProductNotPublished
		}
	}
	return owned, nil
}

func (service *LiveService) requireLiveStoreProduct(ctx context.Context, session *ent.LiveSession, hostId, productId uuid.UUID) (interfaces.StoreProduct, error) {
	if session.StoreID == nil {
		return interfaces.StoreProduct{}, liveerrors.LiveHasNoStore
	}
	if err := service.requireStoreMember(ctx, *session.StoreID, hostId); err != nil {
		return interfaces.StoreProduct{}, err
	}
	owned, err := service.requireStoreProducts(ctx, *session.StoreID, []uuid.UUID{productId}, true)
	if err != nil {
		return interfaces.StoreProduct{}, err
	}
	return owned[productId], nil
}

func snapshotLiveProduct(builder *ent.LiveProductCreate, product interfaces.StoreProduct) *ent.LiveProductCreate {
	builder.SetTitle(product.Title).SetPriceMinor(product.PriceMinor).SetCurrency(product.Currency).SetNillableImageURL(product.ImageUrl)
	return builder
}
