package orders

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/orders/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountOrdersRoutes(mux, deployed)
}
