package stage

import (
	"net/http"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/modules/stage/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountStageRoutes(mux, deployed)
}
