package getlivesharecard

import (
	"context"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/services"
	"zudomart/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.ShareCardView, error) {
	return services.NewLiveService(handler.Container).BuildLiveShareCard(ctx, query.LiveId, query.ViewerId)
}
