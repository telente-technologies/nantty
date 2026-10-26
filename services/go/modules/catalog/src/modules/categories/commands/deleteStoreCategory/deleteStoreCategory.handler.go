package deletestorecategory

import (
	"context"

	"nantty/modules/catalog/src/container"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/category"
	"nantty/modules/catalog/src/generated/ent/product"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		deleted, err := tx.Category.Delete().Where(category.ID(command.CategoryId), category.StoreID(command.Store.StoreId)).Exec(ctx)
		if err != nil {
			return err
		}
		if deleted == 0 {
			return catalogerrors.CategoryNotFound
		}
		return tx.Product.Update().Where(product.StoreID(command.Store.StoreId), product.CategoryID(command.CategoryId)).ClearCategoryID().Exec(ctx)
	})
}
