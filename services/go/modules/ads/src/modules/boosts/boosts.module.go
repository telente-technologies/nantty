package boosts

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/boosts/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountBoostsRoutes(mux, deployed)
}
