package levels

import (
	"net/http"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/modules/levels/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountLevelsRoutes(mux, deployed)
}
