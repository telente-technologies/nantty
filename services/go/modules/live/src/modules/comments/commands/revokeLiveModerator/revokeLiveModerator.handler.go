package revokelivemoderator

import (
	"context"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return services.NewLiveService(handler.Container).RevokeModerator(ctx, command.Actor, command.LiveId, command.UserId)
}
