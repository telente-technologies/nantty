package internalapi

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/modules/internalApi/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountInternalApiRoutes(mux, deployed)
}
