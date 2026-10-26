package topics

import (
	"context"
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/topics/routes"
	"nantty/modules/users/src/modules/topics/services"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountTopicsRoutes(mux, container)
}

func SeedReferenceData(ctx context.Context, container *container.Container) error {
	return services.SeedTopicsIfMissing(ctx, container.Client)
}
