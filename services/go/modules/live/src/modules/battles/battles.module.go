package battles

import (
	"net/http"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/modules/battles/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountBattlesRoutes(mux, deployed)
}
