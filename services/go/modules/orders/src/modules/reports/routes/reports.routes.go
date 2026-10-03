package routes

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/middlewares"
	"zudomart/modules/orders/src/modules/reports/controllers"
)

func MountReportsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.ReportsController{Container: deployed}
	viewer := middlewares.StoreMember(deployed, "reports:view", false)
	mux.Handle("GET /api/v1/seller/reports/exports", viewer(controller.ListExports))
	mux.Handle("POST /api/v1/seller/reports/exports", viewer(controller.RequestExport))
	mux.Handle("GET /api/v1/seller/reports/exports/{exportId}", viewer(controller.DownloadExport))
	mux.Handle("GET /api/v1/seller/reports/{reportKind}", viewer(controller.GetReport))
}
