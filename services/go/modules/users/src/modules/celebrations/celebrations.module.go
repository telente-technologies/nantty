package celebrations

import (
	"context"
	"net/http"
	"time"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/celebrations/routes"
	"zudomart/modules/users/src/modules/celebrations/services"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountCelebrationsRoutes(mux, c)
}

func RunBackgroundWorkersUntilContextDone(ctx context.Context, c *container.Container) error {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		if err := (services.AnniversaryScheduler{Container: c}).RunOnce(ctx); err != nil {
			c.Logger.WarnContext(ctx, "anniversary scheduler failed", "error", err.Error())
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}
