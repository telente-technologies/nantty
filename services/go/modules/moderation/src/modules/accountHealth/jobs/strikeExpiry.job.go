package jobs

import (
	"context"
	"time"

	"nantty/modules/moderation/src/container"
	announceexpiredstrikes "nantty/modules/moderation/src/modules/accountHealth/commands/announceExpiredStrikes"
)

func RunStrikeExpiryWorkerUntilContextDone(ctx context.Context, c *container.Container) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		if _, err := (announceexpiredstrikes.Handler{Container: c}).Execute(ctx); err != nil {
			c.Logger.WarnContext(ctx, "strike expiry run failed", "error", err.Error())
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
