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
	return services.ExpireReadyExports(ctx, handler.Container, func(ctx context.Context) (services.ObjectStore, error) {
		return services.ObjectStoreFor(ctx, handler.Container.Settings.Privacy)
	})
}
