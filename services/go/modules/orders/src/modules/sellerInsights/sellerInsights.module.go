package sellerinsights

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/sellerInsights/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSellerInsightsRoutes(mux, deployed)
}
