package actingprofiles

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/actingProfiles/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountActingProfilesRoutes(mux, container)
}
