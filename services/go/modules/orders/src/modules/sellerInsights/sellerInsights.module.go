package sellerinsights

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/sellerInsights/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSellerInsightsRoutes(mux, deployed)
}
