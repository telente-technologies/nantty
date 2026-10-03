package overlays

import (
	"net/http"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/modules/overlays/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountOverlaysRoutes(mux, deployed)
}
