package promotions

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/promotions/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountPromotionsRoutes(mux, deployed)
}
