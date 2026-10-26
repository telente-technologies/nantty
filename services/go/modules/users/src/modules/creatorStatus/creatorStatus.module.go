package creatorstatus

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/creatorStatus/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountCreatorStatusRoutes(mux, container)
}
