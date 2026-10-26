package levels

import (
	"net/http"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/modules/levels/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountLevelsRoutes(mux, deployed)
}
