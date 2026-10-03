package billing

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/billing/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountBillingRoutes(mux, deployed)
}
