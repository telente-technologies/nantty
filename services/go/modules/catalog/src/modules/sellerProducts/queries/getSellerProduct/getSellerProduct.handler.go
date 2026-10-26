package getsellerproduct

import (
	"context"

	"nantty/modules/catalog/src/container"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/product"
	"nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.SellerProductView, error) {
	row, err := handler.Container.Client.Product.Query().Where(product.ID(query.ProductId), product.StoreID(query.StoreId)).Only(ctx)
	if ent.IsNotFound(err) {
		return types.SellerProductView{}, catalogerrors.ProductNotFound
	}
	if err != nil {
		return types.SellerProductView{}, err
	}
	views, err := services.LoadSellerProductViews(ctx, handler.Container, query.StoreId, []*ent.Product{row})
	if err != nil {
		return types.SellerProductView{}, err
	}
	return views[0], nil
}
