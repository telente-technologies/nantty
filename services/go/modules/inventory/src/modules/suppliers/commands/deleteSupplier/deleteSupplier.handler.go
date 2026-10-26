package deletesupplier

import (
	"context"

	"nantty/modules/inventory/src/container"
	inventoryerrors "nantty/modules/inventory/src/errors"
	"nantty/modules/inventory/src/generated/ent/supplier"
	"nantty/platform/commerceports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	deleted, err := handler.Container.Client.Supplier.Delete().Where(supplier.ID(command.SupplierId), supplier.StoreID(command.Store.StoreId)).Exec(ctx)
	if err != nil {
		return err
	}
	if deleted == 0 {
		return inventoryerrors.SupplierNotFound
	}
	catalog, err := commerceports.Default.CatalogReader()
	if err != nil {
		return err
	}
	return catalog.DetachSupplierFromProducts(ctx, command.Store.StoreId, command.SupplierId)
}
