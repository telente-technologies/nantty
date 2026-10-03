package reports

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/reports/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountReportsRoutes(mux, deployed)
}
