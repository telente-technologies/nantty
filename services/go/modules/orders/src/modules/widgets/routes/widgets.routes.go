package routes

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/middlewares"
	"zudomart/modules/orders/src/modules/widgets/controllers"
)

func MountWidgetRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.NewWidgetsController(deployed)
	mux.Handle("GET /api/v1/widgets/orders", middlewares.WidgetReader(deployed)(controller.ActiveOrders))
	mux.Handle("GET /api/v1/widgets/seller-today", middlewares.WidgetStoreMember(deployed, "dashboard:view")(controller.SellerToday))
}
