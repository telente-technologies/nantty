package accountdeletion

import (
	"context"
	"net/http"
	"time"

	"nantty/modules/users/src/container"
	executedueaccountdeletions "nantty/modules/users/src/modules/accountDeletion/commands/executeDueAccountDeletions"
	"nantty/modules/users/src/modules/accountDeletion/routes"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountAccountDeletionRoutes(mux, c)
}

func RunBackgroundWorkersUntilContextDone(ctx context.Context, c *container.Container) error {
	handler := executedueaccountdeletions.Handler{Container: c}
	ticker := time.NewTicker(c.Settings.Privacy.DeletionWorkerPollInterval)
	defer ticker.Stop()
	for {
		if _, err := handler.Execute(ctx, executedueaccountdeletions.Command{}); err != nil {
			c.Logger.WarnContext(ctx, "account deletion worker iteration failed", "error", err.Error())
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}
