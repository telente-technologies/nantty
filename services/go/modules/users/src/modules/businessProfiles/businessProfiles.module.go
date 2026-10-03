package businessprofiles

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/businessProfiles/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountBusinessProfilesRoutes(mux, container)
}
