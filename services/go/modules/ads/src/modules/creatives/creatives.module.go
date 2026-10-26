package creatives

import (
	"net/http"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/creatives/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountCreativesRoutes(mux, deployed)
}
