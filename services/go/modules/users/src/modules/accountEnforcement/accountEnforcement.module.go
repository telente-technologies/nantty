package accountenforcement

import (
	"context"
	"net/http"
	"time"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/accountEnforcement/routes"
	"zudomart/modules/users/src/modules/accountEnforcement/services"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountAccountEnforcementRoutes(mux, c)
}

func RunBackgroundWorkersUntilContextDone(ctx context.Context, c *container.Container) error {
	ticker := time.NewTicker(c.Settings.Privacy.DeletionWorkerPollInterval)
	defer ticker.Stop()
	for {
		if err := (services.EnforcementWorker{Container: c}).RunOnce(ctx); err != nil {
			c.Logger.WarnContext(ctx, "account enforcement worker iteration failed", "error", err.Error())
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}
