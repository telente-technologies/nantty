package cart

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/cart/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountCartRoutes(mux, deployed)
}
