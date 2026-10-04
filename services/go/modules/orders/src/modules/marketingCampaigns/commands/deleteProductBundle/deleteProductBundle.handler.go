package deleteproductbundle

import (
	"context"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/productbundle"
	"zudomart/modules/orders/src/generated/ent/productbundleitem"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		existing, err := tx.ProductBundle.Query().Where(productbundle.ID(command.BundleId), productbundle.StoreID(command.Store.StoreId)).Only(ctx)
		if ent.IsNotFound(err) {
			return httpserver.ErrNotFound
		}
		if err != nil {
			return err
		}
		if _, err := tx.ProductBundleItem.Delete().Where(productbundleitem.BundleID(existing.ID)).Exec(ctx); err != nil {
			return err
		}
		return tx.ProductBundle.DeleteOne(existing).Exec(ctx)
	})
}
