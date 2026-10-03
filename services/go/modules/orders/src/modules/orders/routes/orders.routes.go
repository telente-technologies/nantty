package routes

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/middlewares"
	"zudomart/modules/orders/src/modules/orders/controllers"
)

func MountOrdersRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.OrdersController{Container: deployed}
	signedIn := middlewares.Authenticated(deployed)
	idempotent := middlewares.Idempotent(deployed)
	mux.Handle("POST /api/v1/orders/checkout", idempotent(controller.Checkout))
	mux.Handle("GET /api/v1/orders", signedIn(controller.ListOrders))
	mux.Handle("GET /api/v1/orders/{orderId}", signedIn(controller.GetOrder))
	mux.Handle("POST /api/v1/orders/{orderId}/cancel", signedIn(controller.CancelOrder))
	mux.Handle("POST /api/v1/orders/{orderId}/confirm-receipt", idempotent(controller.ConfirmReceipt))
}
