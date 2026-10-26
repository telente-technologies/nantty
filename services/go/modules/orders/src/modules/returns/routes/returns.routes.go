package routes

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/middlewares"
	"nantty/modules/orders/src/modules/returns/controllers"
)

func MountReturnsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.ReturnsController{Container: deployed}
	viewer := middlewares.StoreMember(deployed, "orders:view", false)
	manager := middlewares.StoreMember(deployed, "orders:manage", false)
	signedIn := middlewares.Authenticated(deployed)
	mux.Handle("GET /api/v1/seller/returns", viewer(controller.ListSeller))
	mux.Handle("POST /api/v1/seller/returns/{returnId}/approve", manager(controller.Approve))
	mux.Handle("POST /api/v1/seller/returns/{returnId}/decline", manager(controller.Decline))
	mux.Handle("POST /api/v1/seller/returns/{returnId}/receive", manager(controller.Receive))
	mux.Handle("GET /api/v1/returns", signedIn(controller.ListMine))
	mux.Handle("POST /api/v1/orders/{orderId}/returns", signedIn(controller.Request))
}
