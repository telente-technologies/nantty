package deliveryareas

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/deliveryAreas/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountDeliveryAreasRoutes(mux, deployed)
}
