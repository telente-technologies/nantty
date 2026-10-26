package customersegments

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/customerSegments/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountCustomerSegmentsRoutes(mux, deployed)
}
