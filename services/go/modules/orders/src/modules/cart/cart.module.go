package cart

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/cart/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountCartRoutes(mux, deployed)
}
