package sessions

import (
	"net/http"

	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/modules/sessions/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountSessionsRoutes(mux, container)
}
