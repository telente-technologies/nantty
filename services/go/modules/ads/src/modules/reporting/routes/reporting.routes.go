package routes

import (
	"net/http"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/middlewares"
	"nantty/modules/ads/src/modules/reporting/controllers"
)

func MountReportingRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.ReportingController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	mux.Handle("GET /api/v1/ads/accounts/{accountId}/reports", authenticated(controller.Get))
	mux.Handle("GET /api/v1/ads/accounts/{accountId}/ads/{adId}/cards/report", authenticated(controller.AdCards))
	mux.Handle("GET /api/v1/ads/accounts/{accountId}/reports/export", authenticated(controller.Export))
	mux.Handle("GET /api/v1/ads/accounts/{accountId}/reports/export.pdf", authenticated(controller.ExportPdf))
	mux.Handle("GET /api/v1/ads/accounts/{accountId}/reports/scheduled", authenticated(controller.ListScheduled))
	mux.Handle("POST /api/v1/ads/accounts/{accountId}/reports/scheduled", authenticated(controller.CreateScheduled))
	mux.Handle("DELETE /api/v1/ads/accounts/{accountId}/reports/scheduled/{scheduledReportId}", authenticated(controller.DeleteScheduled))
	mux.Handle("GET /api/v1/internal/stores/{storeId}/campaign-report", middlewares.InternalToken(deployed)(controller.StoreCampaignReport))
}
