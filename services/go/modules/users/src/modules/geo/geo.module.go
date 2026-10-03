package geo

import (
	"context"
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/geo/routes"
	"zudomart/modules/users/src/modules/geo/services"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountGeoRoutes(mux, c)
}

func SeedReferenceData(ctx context.Context, c *container.Container) error {
	return services.SeedGeoReferenceDataIfMissing(ctx, c.Client)
}
