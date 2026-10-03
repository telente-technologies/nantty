package profiles

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/profiles/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountProfilesRoutes(mux, container)
}
