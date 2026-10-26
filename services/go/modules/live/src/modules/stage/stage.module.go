package stage

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/modules/stage/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountStageRoutes(mux, deployed)
}
