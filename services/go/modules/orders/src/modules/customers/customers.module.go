package customers

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/customers/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountCustomersRoutes(mux, deployed)
}
