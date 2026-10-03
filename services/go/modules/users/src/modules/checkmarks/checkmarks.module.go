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

func RunBackgroundWorkersUntilContextDone(ctx context.Context, c *container.Container) error {
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
