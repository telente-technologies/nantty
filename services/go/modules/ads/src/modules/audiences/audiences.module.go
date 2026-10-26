package audiences

import (
	"net/http"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/audiences/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountAudiencesRoutes(mux, deployed)
}
