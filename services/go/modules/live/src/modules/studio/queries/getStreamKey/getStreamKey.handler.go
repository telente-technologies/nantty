package getstreamkey

import (
	"context"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/services"
	"zudomart/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.StreamKeyView, error) {
	return services.NewLiveService(handler.Container).GetStreamKey(ctx, query.Actor, query.LiveId, query.Protocol)
}
