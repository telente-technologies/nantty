package movements

import (
	"net/http"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/modules/movements/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountMovementsRoutes(mux, deployed)
}
