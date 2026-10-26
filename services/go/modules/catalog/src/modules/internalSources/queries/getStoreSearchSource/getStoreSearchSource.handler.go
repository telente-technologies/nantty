package getstoresearchsource

import (
	"context"

	"nantty/modules/catalog/src/container"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/modules/internalSources/dtos"
	"nantty/modules/catalog/src/modules/internalSources/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.StoreSearchSource, error) {
	row, err := handler.Container.Client.Store.Get(ctx, query.StoreId)
	if ent.IsNotFound(err) {
		return dtos.StoreSearchSource{}, catalogerrors.StoreNotFound
	}
	if err != nil {
		return dtos.StoreSearchSource{}, err
	}
	return services.BuildStoreSearchSource(ctx, handler.Container, row)
}
