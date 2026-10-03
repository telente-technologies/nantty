package internalapi

import (
	"net/http"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/modules/internalApi/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountInternalApiRoutes(mux, deployed)
}
