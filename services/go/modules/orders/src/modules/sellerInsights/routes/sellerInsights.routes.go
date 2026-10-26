package routes

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/middlewares"
	"nantty/modules/orders/src/modules/sellerInsights/controllers"
)

func MountSellerInsightsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.SellerInsightsController{Container: deployed}
	mux.Handle("GET /api/v1/seller/dashboard", middlewares.StoreMember(deployed, "dashboard:view", false)(controller.Dashboard))
	mux.Handle("GET /api/v1/seller/analytics/overview", middlewares.StoreMember(deployed, "analytics:view", false)(controller.Overview))
	mux.Handle("GET /api/v1/seller/analytics/breakdowns", middlewares.StoreMemberFeature(deployed, "analytics:view", "advanced_analytics", false)(controller.Breakdowns))
}
