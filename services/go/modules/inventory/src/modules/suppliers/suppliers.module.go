package suppliers

import (
	"net/http"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/modules/suppliers/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSuppliersRoutes(mux, deployed)
}
