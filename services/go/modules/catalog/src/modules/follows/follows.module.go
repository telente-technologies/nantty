package follows

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/follows/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountFollowsRoutes(mux, deployed)
}
