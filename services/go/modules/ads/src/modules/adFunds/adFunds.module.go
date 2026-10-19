package adfunds

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/adFunds/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountAdFundsRoutes(mux, deployed)
}
