package movements

import (
	"net/http"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/modules/movements/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountMovementsRoutes(mux, deployed)
}
