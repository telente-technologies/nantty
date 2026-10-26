package getliveadeligibility

import (
	"context"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.LiveAdEligibilityView, error) {
	return services.NewLiveService(handler.Container).GetLiveAdEligibility(ctx, query.LiveId)
}
