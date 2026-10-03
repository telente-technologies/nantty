package audiences

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/audiences/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountAudiencesRoutes(mux, deployed)
}
