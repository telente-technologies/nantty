package overlays

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/modules/overlays/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountOverlaysRoutes(mux, deployed)
}
