package listgiftcatalog

import (
	"context"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Query) ([]types.LiveGiftView, error) {
	return services.NewLiveService(handler.Container).ListGiftCatalog(ctx, command.IncludeInactive)
}
