package updateoverlayscene

import (
	"context"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/services"
	"zudomart/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.OverlaySceneView, error) {
	return services.NewLiveService(handler.Container).UpdateOverlayScene(ctx, command.Actor, command.LiveId, command.SceneId, command.Input)
}
