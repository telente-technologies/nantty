package tracking

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/tracking/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountTrackingRoutes(mux, deployed)
}
