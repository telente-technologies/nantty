package creatorstatus

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/creatorStatus/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountCreatorStatusRoutes(mux, container)
}
