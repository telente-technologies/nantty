package setrecordinglegalhold

import (
	"context"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (int, error) {
	return services.NewLiveService(handler.Container).SetLiveRecordingLegalHold(ctx, command.LiveId, command.Held)
}
