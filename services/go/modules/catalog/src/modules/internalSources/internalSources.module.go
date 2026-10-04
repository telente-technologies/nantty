package internalsources

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/internalSources/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountInternalSourcesRoutes(mux, deployed)
}
