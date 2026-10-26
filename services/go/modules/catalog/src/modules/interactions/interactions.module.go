package interactions

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/interactions/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountInteractionsRoutes(mux, deployed)
}
