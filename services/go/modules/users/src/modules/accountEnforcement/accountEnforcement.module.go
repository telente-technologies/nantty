package accountenforcement

import (
	"context"
	"net/http"
	"time"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/accountEnforcement/routes"
	"nantty/modules/users/src/modules/accountEnforcement/services"
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
