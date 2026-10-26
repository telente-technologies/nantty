package searchsources

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/searchSources/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSearchSourcesRoutes(mux, deployed)
}
