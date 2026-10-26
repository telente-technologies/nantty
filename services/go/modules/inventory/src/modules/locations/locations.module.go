package locations

import (
	"net/http"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/modules/locations/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountLocationsRoutes(mux, deployed)
}
