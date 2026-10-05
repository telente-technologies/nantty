package adminorders

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/adminOrders/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountAdminOrdersRoutes(mux, deployed)
}
