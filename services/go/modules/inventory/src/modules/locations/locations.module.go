package locations

import (
	"net/http"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/modules/locations/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountLocationsRoutes(mux, deployed)
}
