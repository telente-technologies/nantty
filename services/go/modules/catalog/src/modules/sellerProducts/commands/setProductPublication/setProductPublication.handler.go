package setproductpublication

import (
	"context"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/enums"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/events"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/product"
	"nantty/modules/catalog/src/generated/ent/productmedia"
	getsellerproduct "nantty/modules/catalog/src/modules/sellerProducts/queries/getSellerProduct"
	"nantty/modules/catalog/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.SellerProductView, error) {
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.Product.Query().Where(product.ID(command.ProductId), product.StoreID(command.Store.StoreId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return catalogerrors.ProductNotFound
		}
		if err != nil {
			return err
		}
		update := row.Update().SetPublishedOnline(command.Publish)
		eventType := "product.unpublished"
		if command.Publish {
			if row.Status != enums.ProductActive {
				return catalogerrors.ProductNotActive
			}
			if hasImage, err := tx.ProductMedia.Query().Where(productmedia.ProductID(row.ID), productmedia.Kind("image")).Exist(ctx); err != nil || !hasImage {
				if err == nil {
					err = catalogerrors.ProductNeedsImage
				}
				return err
			}
			eventType = "product.published"
			if row.PublishedAt == nil {
				update.SetPublishedAt(handler.Container.Now())
			}
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, eventType, row.ID.String(), handler.Container.Now(), map[string]any{"productId": row.ID, "storeId": row.StoreID})
	})
	if err != nil {
		return types.SellerProductView{}, err
	}
	return (getsellerproduct.Handler{Container: handler.Container}).Execute(ctx, getsellerproduct.Query{StoreId: command.Store.StoreId, ProductId: command.ProductId})
}
