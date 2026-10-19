package repostliverecording

import (
	"context"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/services"
	"zudomart/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.RecordingView, error) {
	return services.NewLiveService(handler.Container).RepostLiveRecording(ctx, command.Actor, command.LiveId, command.RecordingId)
}
