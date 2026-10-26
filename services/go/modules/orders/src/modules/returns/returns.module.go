package returns

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/returns/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountReturnsRoutes(mux, deployed)
}
