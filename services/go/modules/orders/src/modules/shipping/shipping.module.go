package shipping

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/shipping/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountShippingRoutes(mux, deployed)
}
