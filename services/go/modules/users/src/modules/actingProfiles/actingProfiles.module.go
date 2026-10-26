package actingprofiles

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/actingProfiles/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountActingProfilesRoutes(mux, container)
}
