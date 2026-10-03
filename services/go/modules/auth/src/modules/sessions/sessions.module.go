package sessions

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/modules/sessions/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountSessionsRoutes(mux, container)
}
