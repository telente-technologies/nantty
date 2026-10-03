package sellerorders

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/sellerOrders/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSellerOrdersRoutes(mux, deployed)
}
