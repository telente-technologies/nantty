package deletesupplier

import (
	"context"

	"zudomart/modules/inventory/src/container"
	inventoryerrors "zudomart/modules/inventory/src/errors"
	"zudomart/modules/inventory/src/generated/ent/supplier"
	"zudomart/platform/commerceports"
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
