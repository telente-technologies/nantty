package platformmetrics

import (
	"net/http"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/modules/platformMetrics/routes"
)

func MountRoutes(mux *http.ServeMux, container *container.Container) {
	routes.MountPlatformMetricsRoutes(mux, container)
}
