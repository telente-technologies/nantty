package studio

import (
	"net/http"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/modules/studio/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountStudioRoutes(mux, deployed)
}
