package customersegments

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/customerSegments/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountCustomerSegmentsRoutes(mux, deployed)
}
