package jobs

import (
	"context"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"
)

func RunDueTimerSweepsUntilContextDone(ctx context.Context, deployed *container.Container) error {
	return services.NewLiveService(deployed).RunDueTimerSweepsUntilContextDone(ctx)
}
