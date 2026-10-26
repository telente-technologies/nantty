package creategift

import (
	"context"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.LiveGiftView, error) {
	return services.NewLiveService(handler.Container).CreateGift(ctx, command.Input)
}
