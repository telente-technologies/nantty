package awardengagementpoints

import (
	"context"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/services"
	"zudomart/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.EngagementAward, error) {
	return services.NewLiveService(handler.Container).AwardEngagementPoints(ctx, command.Actor, command.LiveId, command.Action)
}
