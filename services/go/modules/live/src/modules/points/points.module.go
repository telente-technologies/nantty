package points

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/modules/points/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountPointsRoutes(mux, deployed)
}
