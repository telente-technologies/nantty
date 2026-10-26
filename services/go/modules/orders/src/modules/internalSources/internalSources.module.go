package internalsources

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/internalSources/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountInternalSourcesRoutes(mux, deployed)
}
