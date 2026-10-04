package getproductsearchsource

import (
	"context"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/modules/internalSources/dtos"
	"zudomart/modules/catalog/src/modules/internalSources/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.ProductSearchSource, error) {
	row, err := handler.Container.Client.Product.Get(ctx, query.ProductId)
	if ent.IsNotFound(err) {
		return dtos.ProductSearchSource{}, catalogerrors.ProductNotFound
	}
	if err != nil {
		return dtos.ProductSearchSource{}, err
	}
	return services.BuildProductSearchSource(ctx, handler.Container, row)
}
