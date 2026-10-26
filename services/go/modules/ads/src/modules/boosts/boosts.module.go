package boosts

import (
	"net/http"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/boosts/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountBoostsRoutes(mux, deployed)
}
