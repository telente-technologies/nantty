package transfers

import (
	"net/http"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/modules/transfers/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountTransfersRoutes(mux, deployed)
}
