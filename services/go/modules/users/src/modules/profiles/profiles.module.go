package profiles

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/profiles/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountProfilesRoutes(mux, container)
}
