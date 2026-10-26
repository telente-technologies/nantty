package routes

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/middlewares"
	"nantty/modules/orders/src/modules/customerSegments/controllers"
)

func MountCustomerSegmentsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.CustomerSegmentsController{Container: deployed}
	viewer := middlewares.StoreMemberFeature(deployed, "customers:view", "customer_segments", false)
	manager := middlewares.StoreMemberFeature(deployed, "customers:manage", "customer_segments", false)
	mux.Handle("GET /api/v1/seller/customers/segments", viewer(controller.List))
	mux.Handle("POST /api/v1/seller/customers/segments", manager(controller.Create))
	mux.Handle("PATCH /api/v1/seller/customers/segments/{segmentId}", manager(controller.Update))
	mux.Handle("DELETE /api/v1/seller/customers/segments/{segmentId}", manager(controller.Delete))
}
