package internalsources

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/internalSources/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountInternalSourcesRoutes(mux, deployed)
}
