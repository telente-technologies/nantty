package addresses

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/addresses/routes"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountAddressesRoutes(mux, c)
}
