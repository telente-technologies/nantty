package stores

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/stores/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountStoresRoutes(mux, deployed)
}
