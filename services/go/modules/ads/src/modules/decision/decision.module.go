package decision

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/decision/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountDecisionRoutes(mux, deployed)
}
