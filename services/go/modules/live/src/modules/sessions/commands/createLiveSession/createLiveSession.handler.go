package createlivesession

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
	live := services.NewLiveService(handler.Container)
	if err := live.EnsureHostCanGoLive(ctx, command.Actor.UserId.String()); err != nil {
		return types.LiveSessionView{}, err
	}
	return live.CreateLiveSession(ctx, command.Actor, command.Input)
}
