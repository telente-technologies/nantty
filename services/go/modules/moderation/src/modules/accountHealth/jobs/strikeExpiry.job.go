package jobs

import (
	"context"
	"time"

	"zudomart/modules/moderation/src/container"
	announceexpiredstrikes "zudomart/modules/moderation/src/modules/accountHealth/commands/announceExpiredStrikes"
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
