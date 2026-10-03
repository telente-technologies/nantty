package getliveleaderboard

import (
	"context"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/services"
	"zudomart/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Query) (types.LeaderboardView, error) {
	return services.NewLiveService(handler.Container).GetLiveLeaderboard(ctx, command.LiveId, command.Viewer, command.Receiver, command.Limit)
}
