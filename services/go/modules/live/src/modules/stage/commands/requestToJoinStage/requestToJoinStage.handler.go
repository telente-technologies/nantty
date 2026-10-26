package requesttojoinstage

import (
	"context"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return services.NewLiveService(handler.Container).RequestToJoinStage(ctx, command.Actor, command.LiveId)
}
