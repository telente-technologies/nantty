package geo

import (
	"context"
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/geo/routes"
	"nantty/modules/users/src/modules/geo/services"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountGeoRoutes(mux, c)
}

func SeedReferenceData(ctx context.Context, c *container.Container) error {
	return services.SeedGeoReferenceDataIfMissing(ctx, c.Client)
}
