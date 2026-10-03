package returns

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/returns/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountReturnsRoutes(mux, deployed)
}
