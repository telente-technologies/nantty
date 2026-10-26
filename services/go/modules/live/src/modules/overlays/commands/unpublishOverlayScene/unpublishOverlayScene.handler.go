package unpublishoverlayscene

import (
	"context"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.OverlaySceneView, error) {
	return services.NewLiveService(handler.Container).UnpublishOverlayScene(ctx, command.Actor, command.LiveId, command.SceneId)
}
