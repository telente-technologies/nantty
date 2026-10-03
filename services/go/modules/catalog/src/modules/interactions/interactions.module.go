package interactions

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/interactions/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountInteractionsRoutes(mux, deployed)
}
