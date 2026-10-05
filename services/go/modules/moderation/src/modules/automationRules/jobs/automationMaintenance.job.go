package jobs

import (
	"context"
	"time"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/modules/automationRules/repositories"
	"zudomart/modules/moderation/src/modules/automationRules/services"
)

func DeleteExpiredOccurrences(ctx context.Context, c *container.Container) (int, error) {
	return repositories.EntStore{Container: c}.DeleteOccurrencesBefore(ctx, c.Now().Add(-services.OccurrenceRetention))
}

func RunOccurrenceCleanupUntilContextDone(ctx context.Context, c *container.Container) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		if _, err := DeleteExpiredOccurrences(ctx, c); err != nil && ctx.Err() == nil {
			c.Logger.WarnContext(ctx, "automation occurrence cleanup failed", "error", err.Error())
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
