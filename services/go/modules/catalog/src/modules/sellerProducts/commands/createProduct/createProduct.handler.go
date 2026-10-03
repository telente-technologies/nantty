package createproduct

import (
	"context"

	"zudomart/modules/catalog/src/container"
	getsellerproduct "zudomart/modules/catalog/src/modules/sellerProducts/queries/getSellerProduct"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.SellerProductView, error) {
	productId, err := services.WriteProduct(ctx, handler.Container, services.ProductWrite{Store: command.Store, ActorId: command.ActorId, Request: command.Request})
	if err != nil {
		return types.SellerProductView{}, err
	}
	return (getsellerproduct.Handler{Container: handler.Container}).Execute(ctx, getsellerproduct.Query{StoreId: command.Store.StoreId, ProductId: productId})
}
