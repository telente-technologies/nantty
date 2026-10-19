package gethostlivestatus

import (
	"context"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/services"
	"zudomart/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.HostLiveStatusView, error) {
	return services.NewLiveService(handler.Container).CurrentLiveOfHostForViewer(ctx, query.HostId, query.Viewer)
}
