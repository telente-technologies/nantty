package creatives

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/creatives/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountCreativesRoutes(mux, deployed)
}
