package jobs

import (
	"context"
	"time"

	"nantty/modules/moderation/src/container"
	restoreacceptedtakedowns "nantty/modules/moderation/src/modules/copyrightClaims/commands/restoreAcceptedTakedowns"
)

func RunRestoreWorkerUntilContextDone(ctx context.Context, c *container.Container) {
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()
	for {
		if _, err := (restoreacceptedtakedowns.Handler{Container: c}).Execute(ctx); err != nil {
			c.Logger.WarnContext(ctx, "copyright restoration run failed", "error", err.Error())
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
