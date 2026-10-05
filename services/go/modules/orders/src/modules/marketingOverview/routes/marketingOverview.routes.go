package routes

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/middlewares"
	"zudomart/modules/orders/src/modules/marketingOverview/controllers"
)

func MountMarketingOverviewRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.MarketingOverviewController{Container: deployed}
	mux.Handle("GET /api/v1/seller/marketing/overview", middlewares.StoreMember(deployed, "promotions:manage", false)(controller.Get))
}
