package getpublicoverlayscene

import (
	"context"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.PublicOverlaySceneView, error) {
	return services.NewLiveService(handler.Container).GetPublicOverlayScene(ctx, query.SceneId)
}
