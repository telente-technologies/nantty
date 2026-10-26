package reports

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/reports/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountReportsRoutes(mux, deployed)
}
