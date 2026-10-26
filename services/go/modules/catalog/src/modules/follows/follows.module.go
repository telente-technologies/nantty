package follows

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/follows/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountFollowsRoutes(mux, deployed)
}
