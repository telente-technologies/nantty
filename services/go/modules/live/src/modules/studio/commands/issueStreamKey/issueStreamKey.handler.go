package issuestreamkey

import (
	"context"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.StreamKeyView, error) {
	return services.NewLiveService(handler.Container).IssueStreamKey(ctx, command.Actor, command.LiveId, command.Protocol)
}
