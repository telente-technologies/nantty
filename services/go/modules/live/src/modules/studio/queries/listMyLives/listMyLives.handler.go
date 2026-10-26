package listmylives

import (
	"context"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]types.StudioLiveView, string, error) {
	return services.NewLiveService(handler.Container).ListMyLives(ctx, query.Actor, query.Cursor, query.Limit)
}
