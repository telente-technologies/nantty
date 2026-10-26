package consents

import (
	"context"
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/consents/routes"
	"nantty/modules/users/src/modules/consents/services"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountConsentsRoutes(mux, c)
}

func SeedReferenceData(ctx context.Context, c *container.Container) error {
	return services.SeedInitialPolicyVersionsIfMissing(ctx, c.Client)
}
