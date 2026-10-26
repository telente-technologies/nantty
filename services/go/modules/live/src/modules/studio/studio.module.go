package studio

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/modules/studio/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountStudioRoutes(mux, deployed)
}
