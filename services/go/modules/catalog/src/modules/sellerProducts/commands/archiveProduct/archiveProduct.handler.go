package archiveproduct

import (
	"context"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/events"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/product"
	getsellerproduct "zudomart/modules/catalog/src/modules/sellerProducts/queries/getSellerProduct"
	"zudomart/modules/catalog/src/types"
	"zudomart/platform/commerceports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.SellerProductView, error) {
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		updated, err := tx.Product.Update().Where(product.ID(command.ProductId), product.StoreID(command.Store.StoreId)).
			SetStatus(enums.ProductArchived).SetPublishedOnline(false).ClearPublishAt().ClearPublishedAt().Save(ctx)
		if err != nil {
			return err
		}
		if updated == 0 {
			return catalogerrors.ProductNotFound
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "product.archived", command.ProductId.String(), handler.Container.Now(),
			map[string]any{"productId": command.ProductId, "storeId": command.Store.StoreId})
	})
	if err != nil {
		return types.SellerProductView{}, err
	}
	if inventory, portError := commerceports.Default.InventoryStock(); portError == nil {
		if err := inventory.SetProductListed(ctx, command.Store.StoreId, command.ProductId, false); err != nil {
			return types.SellerProductView{}, err
		}
	}
	return (getsellerproduct.Handler{Container: handler.Container}).Execute(ctx, getsellerproduct.Query{StoreId: command.Store.StoreId, ProductId: command.ProductId})
}
