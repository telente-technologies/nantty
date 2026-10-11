package updatelivedetails

import (
	"context"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/services"
	"zudomart/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.LiveSessionView, error) {
	return services.NewLiveService(handler.Container).UpdateLiveDetails(ctx, command.Actor, command.LiveId, command.Input)
}
