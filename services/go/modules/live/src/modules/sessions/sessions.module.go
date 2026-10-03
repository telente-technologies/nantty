package sessions

import (
	"net/http"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/modules/sessions/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSessionsRoutes(mux, deployed)
}
