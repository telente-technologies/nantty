package battles

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/modules/battles/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountBattlesRoutes(mux, deployed)
}
