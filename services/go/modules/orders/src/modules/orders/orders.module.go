package orders

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/orders/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountOrdersRoutes(mux, deployed)
}
