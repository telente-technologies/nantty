package points

import (
	"net/http"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/modules/points/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountPointsRoutes(mux, deployed)
}
