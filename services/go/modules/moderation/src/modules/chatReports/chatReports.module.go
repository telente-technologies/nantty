package chatreports

import (
	"context"
	"net/http"
	"time"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/modules/chatReports/routes"
	"nantty/modules/moderation/src/modules/chatReports/services"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountChatReportsRoutes(mux, c)
}

func RunBackgroundWorkersUntilContextDone(ctx context.Context, c *container.Container) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		if err := (services.EvidencePurger{Container: c}).RunOnce(ctx); err != nil {
			c.Logger.WarnContext(ctx, "chat evidence purge failed", "error", err.Error())
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
