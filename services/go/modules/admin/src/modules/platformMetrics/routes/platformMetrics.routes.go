package routes

import (
	"net/http"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/platformMetrics/controllers"
)

func MountPlatformMetricsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.PlatformMetricsController{Container: container}
	mux.Handle("GET /api/v1/admin/metrics/overview", container.Guard.RequireStaff("metrics:read", false)(http.HandlerFunc(controller.Overview)))
}
