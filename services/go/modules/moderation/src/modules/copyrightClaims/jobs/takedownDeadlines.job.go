package jobs

import (
	"context"
	"time"

	"nantty/modules/moderation/src/container"
	enforcetakedowndeadlines "nantty/modules/moderation/src/modules/copyrightClaims/commands/enforceTakedownDeadlines"
)

func RunTakedownDeadlineWorkerUntilContextDone(ctx context.Context, c *container.Container) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		if _, err := (enforcetakedowndeadlines.Handler{Container: c}).Execute(ctx); err != nil {
			c.Logger.WarnContext(ctx, "copyright takedown deadline run failed", "error", err.Error())
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
