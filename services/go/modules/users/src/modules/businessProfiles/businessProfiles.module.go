package businessprofiles

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/businessProfiles/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountBusinessProfilesRoutes(mux, container)
}
