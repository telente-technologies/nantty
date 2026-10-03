package cancelpendingbattle

import (
	"context"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/services"

	"github.com/google/uuid"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (uuid.UUID, error) {
	return services.NewLiveService(handler.Container).CancelPendingBattle(ctx, command.Actor, command.BattleId)
}
