package createlivesession

import (
	"context"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.LiveSessionView, error) {
	live := services.NewLiveService(handler.Container)
	if err := live.EnsureHostCanGoLive(ctx, command.Actor.UserId.String()); err != nil {
		return types.LiveSessionView{}, err
	}
	return live.CreateLiveSession(ctx, command.Actor, command.Input)
}
