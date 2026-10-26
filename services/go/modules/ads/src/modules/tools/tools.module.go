package tools

import (
	"net/http"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/tools/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountToolsRoutes(mux, deployed)
}
