package setrecordinglegalhold

import (
	"context"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (int, error) {
	return services.NewLiveService(handler.Container).SetLiveRecordingLegalHold(ctx, command.LiveId, command.Held)
}
