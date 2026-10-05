package topics

import (
	"context"
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/topics/routes"
	"zudomart/modules/users/src/modules/topics/services"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountTopicsRoutes(mux, container)
}

func SeedReferenceData(ctx context.Context, container *container.Container) error {
	return services.SeedTopicsIfMissing(ctx, container.Client)
}
