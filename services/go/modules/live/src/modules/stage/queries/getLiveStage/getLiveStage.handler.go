package getlivestage

import (
	"context"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Query) (types.LiveStageView, error) {
	return services.NewLiveService(handler.Container).GetLiveStage(ctx, command.LiveId, command.Viewer)
}
