package billing

import (
	"net/http"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/billing/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountBillingRoutes(mux, deployed)
}
