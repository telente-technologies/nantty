package routes

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/middlewares"
	"zudomart/modules/orders/src/modules/customers/controllers"
)

func MountCustomersRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.CustomersController{Container: deployed}
	viewer := middlewares.StoreMember(deployed, "customers:view", false)
	manager := middlewares.StoreMember(deployed, "customers:manage", false)
	mux.Handle("GET /api/v1/seller/customers", viewer(controller.List))
	mux.Handle("GET /api/v1/seller/customers/summary", viewer(controller.Summary))
	mux.Handle("GET /api/v1/seller/customers/export", viewer(controller.Export))
	mux.Handle("GET /api/v1/seller/customers/{customerId}", viewer(controller.Get))
	mux.Handle("GET /api/v1/seller/customers/{customerId}/purchases", viewer(controller.Purchases))
	mux.Handle("POST /api/v1/seller/customers/{customerId}/notes", manager(controller.AddNote))
}
