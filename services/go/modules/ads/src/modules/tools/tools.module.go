package tools

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/tools/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountToolsRoutes(mux, deployed)
}
