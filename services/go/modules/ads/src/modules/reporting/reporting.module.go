package reporting

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/reporting/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountReportingRoutes(mux, deployed)
}
