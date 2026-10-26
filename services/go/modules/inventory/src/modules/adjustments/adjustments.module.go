package adjustments

import (
	"net/http"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/modules/adjustments/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountAdjustmentsRoutes(mux, deployed)
}
