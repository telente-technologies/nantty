package checkmarks

import (
	"context"
	"net/http"
	"time"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/checkmarks/routes"
	"zudomart/modules/users/src/modules/checkmarks/services"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountCheckmarksRoutes(mux, c)
}

func RunSuggestionSchedulerDailyUntilContextDone(ctx context.Context, c *container.Container) {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	for {
		if err := (services.SuggestionScheduler{Container: c}).RunOnce(ctx); err != nil {
			c.Logger.WarnContext(ctx, "checkmark suggestion scheduler failed", "error", err.Error())
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func RunBackgroundWorkersUntilContextDone(ctx context.Context, c *container.Container) error {
	go RunSuggestionSchedulerDailyUntilContextDone(ctx, c)
	ticker := time.NewTicker(c.Settings.Privacy.DeletionWorkerPollInterval)
	defer ticker.Stop()
	for {
		if err := (services.ReverificationWorker{Container: c}).RunOnce(ctx); err != nil {
			c.Logger.WarnContext(ctx, "checkmark reverification worker failed", "error", err.Error())
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}
