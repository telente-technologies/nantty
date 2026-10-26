package internalsources

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/internalSources/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountInternalSourcesRoutes(mux, deployed)
}
