package expiredataexports

import (
	"context"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/dataExport/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Command) (int, error) {
	store, err := services.ObjectStoreFor(ctx, handler.Container.Settings.Privacy)
	if err != nil {
		return 0, err
	}
	return services.ExpireReadyExports(ctx, handler.Container, store)
}
