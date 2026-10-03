package customers

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/customers/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountCustomersRoutes(mux, deployed)
}
