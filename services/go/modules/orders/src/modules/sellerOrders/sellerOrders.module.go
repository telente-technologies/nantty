package sellerorders

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/sellerOrders/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSellerOrdersRoutes(mux, deployed)
}
