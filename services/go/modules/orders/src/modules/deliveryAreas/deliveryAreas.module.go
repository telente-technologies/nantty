package deliveryareas

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/deliveryAreas/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountDeliveryAreasRoutes(mux, deployed)
}
