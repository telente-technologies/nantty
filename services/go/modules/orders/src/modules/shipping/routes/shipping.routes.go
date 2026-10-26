package routes

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/middlewares"
	"nantty/modules/orders/src/modules/shipping/controllers"
)

func MountShippingRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.ShippingController{Container: deployed}
	reader := middlewares.StoreMember(deployed, "settings:view", false)
	writer := middlewares.StoreMember(deployed, "delivery:manage", false)
	mux.Handle("GET /api/v1/seller/shipping/profile", reader(controller.GetProfile))
	mux.Handle("GET /api/v1/seller/shipping/profiles", reader(controller.ListProfiles))
	mux.Handle("PATCH /api/v1/seller/shipping/profile", writer(controller.PatchProfile))
	mux.Handle("POST /api/v1/seller/shipping/rules", writer(controller.CreateRule))
	mux.Handle("PATCH /api/v1/seller/shipping/rules/{ruleId}", writer(controller.UpdateRule))
	mux.Handle("DELETE /api/v1/seller/shipping/rules/{ruleId}", writer(controller.DeleteRule))
	mux.Handle("GET /api/v1/seller/shipping/preview", reader(controller.Preview))
}
