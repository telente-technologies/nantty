package linkedprofiles

import (
	"context"
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/linkedProfiles/routes"
	"nantty/modules/users/src/modules/linkedProfiles/services"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountLinkedProfilesRoutes(mux, container)
}

func BackfillRegistry(ctx context.Context, container *container.Container) (services.BackfillReport, error) {
	return services.Backfill{Container: container}.Run(ctx)
}
