package stores

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/stores/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountStoresRoutes(mux, deployed)
}
