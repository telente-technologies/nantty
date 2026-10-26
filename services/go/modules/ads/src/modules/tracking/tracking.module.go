package tracking

import (
	"net/http"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/tracking/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountTrackingRoutes(mux, deployed)
}
