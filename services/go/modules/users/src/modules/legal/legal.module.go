package legal

import (
	"context"
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/legal/routes"
	"nantty/modules/users/src/modules/legal/services"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountLegalRoutes(mux, c)
}

func SeedReferenceData(ctx context.Context, c *container.Container) error {
	return services.SeedLegalDocumentsIfMissing(ctx, c.Client)
}
