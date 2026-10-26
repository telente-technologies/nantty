package adminorders

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/adminOrders/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountAdminOrdersRoutes(mux, deployed)
}
