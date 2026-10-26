package platformmetrics

import (
	"net/http"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/platformMetrics/routes"
)

func MountRoutes(mux *http.ServeMux, container *container.Container) {
	routes.MountPlatformMetricsRoutes(mux, container)
}
