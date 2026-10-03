package promotions

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/promotions/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountPromotionsRoutes(mux, deployed)
}
