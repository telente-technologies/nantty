package routes

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/middlewares"
	"nantty/modules/orders/src/modules/marketingOverview/controllers"
)

func MountMarketingOverviewRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.MarketingOverviewController{Container: deployed}
	mux.Handle("GET /api/v1/seller/marketing/overview", middlewares.StoreMember(deployed, "promotions:manage", false)(controller.Get))
}
