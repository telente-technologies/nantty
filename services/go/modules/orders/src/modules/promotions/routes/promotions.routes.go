package routes

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/middlewares"
	"zudomart/modules/orders/src/modules/promotions/controllers"
)

func MountPromotionsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.PromotionsController{Container: deployed}
	manager := middlewares.StoreMember(deployed, "promotions:manage", false)
	mux.Handle("GET /api/v1/seller/promotions", manager(controller.List))
	mux.Handle("POST /api/v1/seller/promotions", manager(controller.Create))
	mux.Handle("POST /api/v1/seller/promotions/validate-code", manager(controller.ValidateCode))
	mux.Handle("GET /api/v1/seller/promotions/{promotionId}", manager(controller.Get))
	mux.Handle("PATCH /api/v1/seller/promotions/{promotionId}", manager(controller.Update))
	mux.Handle("DELETE /api/v1/seller/promotions/{promotionId}", manager(controller.Delete))
}
