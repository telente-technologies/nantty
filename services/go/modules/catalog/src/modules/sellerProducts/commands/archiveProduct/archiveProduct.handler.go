package archiveproduct

import (
	"context"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/enums"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/events"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/product"
	getsellerproduct "nantty/modules/catalog/src/modules/sellerProducts/queries/getSellerProduct"
	"nantty/modules/catalog/src/types"
	"nantty/platform/commerceports"
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
