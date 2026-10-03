package transfers

import (
	"net/http"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/modules/transfers/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountTransfersRoutes(mux, deployed)
}
