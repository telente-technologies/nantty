package shipping

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/shipping/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountShippingRoutes(mux, deployed)
}
