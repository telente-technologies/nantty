package jobs

import (
	"context"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/services"
)

func RunDueTimerSweepsUntilContextDone(ctx context.Context, deployed *container.Container) error {
	return services.NewLiveService(deployed).RunDueTimerSweepsUntilContextDone(ctx)
}
