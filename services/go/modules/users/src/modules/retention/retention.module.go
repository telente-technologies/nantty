package retention

import (
	"context"
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/retention/routes"
	"nantty/modules/users/src/modules/retention/services"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountRetentionRoutes(mux, c)
}

func SeedReferenceData(ctx context.Context, c *container.Container) error {
	return services.SeedDefaultRetentionPoliciesIfMissing(ctx, c.Client)
}
