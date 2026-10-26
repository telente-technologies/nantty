package respondtowinnertakesallproposal

import (
	"context"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"

	"github.com/google/uuid"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (uuid.UUID, error) {
	return services.NewLiveService(handler.Container).RespondToWinnerTakesAllProposal(ctx, command.Actor, command.BattleId, command.Accept)
}
