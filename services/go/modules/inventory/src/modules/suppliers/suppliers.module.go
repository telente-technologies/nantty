package suppliers

import (
	"net/http"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/modules/suppliers/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSuppliersRoutes(mux, deployed)
}
