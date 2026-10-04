package searchsources

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/searchSources/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSearchSourcesRoutes(mux, deployed)
}
