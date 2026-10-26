package jobs

import (
	"context"
	"log/slog"
	"time"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"
)

func RunLiveRecordingRetentionUntilContextDone(ctx context.Context, deployed *container.Container) {
	interval := deployed.Settings.RecordingRetentionInterval
	if interval <= 0 {
		return
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			purged, err := services.NewLiveService(deployed).PurgeUnrepostedLiveRecordingsPastRetention(ctx)
			if err != nil && ctx.Err() == nil {
				deployed.Logger.WarnContext(ctx, "live recording retention sweep failed", slog.Any("error", err))
			} else if purged > 0 {
				deployed.Logger.InfoContext(ctx, "expired live recordings deleted", slog.Int("count", purged))
			}
		}
	}
}
