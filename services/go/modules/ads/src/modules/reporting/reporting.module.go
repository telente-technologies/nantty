package reporting

import (
	"net/http"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/reporting/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountReportingRoutes(mux, deployed)
}
