package listmylives

import (
	"context"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/services"
	"zudomart/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]types.StudioLiveView, string, error) {
	return services.NewLiveService(handler.Container).ListMyLives(ctx, query.Actor, query.Cursor, query.Limit)
}
