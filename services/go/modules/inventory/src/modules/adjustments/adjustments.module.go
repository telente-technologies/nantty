package adjustments

import (
	"net/http"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/modules/adjustments/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountAdjustmentsRoutes(mux, deployed)
}
