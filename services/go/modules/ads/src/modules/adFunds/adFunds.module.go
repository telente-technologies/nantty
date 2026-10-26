package adfunds

import (
	"net/http"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/adFunds/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountAdFundsRoutes(mux, deployed)
}
