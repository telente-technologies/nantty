package updatehostdefaults

import (
	"context"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/services"
	"zudomart/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.HostDefaultsView, error) {
	return services.NewLiveService(handler.Container).UpdateHostDefaults(ctx, command.Actor, command.Input)
}
