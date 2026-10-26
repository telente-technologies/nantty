package decision

import (
	"net/http"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/decision/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountDecisionRoutes(mux, deployed)
}
