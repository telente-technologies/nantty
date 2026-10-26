package sessions

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/modules/sessions/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSessionsRoutes(mux, deployed)
}
