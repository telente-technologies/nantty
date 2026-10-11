package linkedprofiles

import (
	"context"
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/linkedProfiles/routes"
	"zudomart/modules/users/src/modules/linkedProfiles/services"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountLinkedProfilesRoutes(mux, container)
}

func BackfillRegistry(ctx context.Context, container *container.Container) (services.BackfillReport, error) {
	return services.Backfill{Container: container}.Run(ctx)
}
