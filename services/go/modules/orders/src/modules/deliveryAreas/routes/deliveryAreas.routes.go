package routes

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/middlewares"
	"nantty/modules/orders/src/modules/deliveryAreas/controllers"
)

func MountDeliveryAreasRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.DeliveryAreasController{Container: deployed}
	manager := middlewares.StoreMember(deployed, "delivery:manage", false)
	mux.Handle("GET /api/v1/seller/delivery/areas", manager(controller.List))
	mux.Handle("POST /api/v1/seller/delivery/areas", manager(controller.Create))
	mux.Handle("PATCH /api/v1/seller/delivery/areas/{areaId}", manager(controller.Update))
	mux.Handle("DELETE /api/v1/seller/delivery/areas/{areaId}", manager(controller.Delete))
}
