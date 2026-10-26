package getmainoverlayscene

import (
	"context"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.OverlaySceneView, error) {
	return services.NewLiveService(handler.Container).GetMainOverlayScene(ctx, query.Actor, query.LiveId)
}
