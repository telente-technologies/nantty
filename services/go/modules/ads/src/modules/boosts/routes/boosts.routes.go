package routes

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/middlewares"
	"zudomart/modules/ads/src/modules/boosts/controllers"
)

func MountBoostsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.BoostsController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	mux.Handle("GET /api/v1/ads/boosts/options", authenticated(controller.GetOptions))
	mux.Handle("POST /api/v1/ads/boosts/estimate", authenticated(controller.Estimate))
	mux.Handle("POST /api/v1/ads/boosts", middlewares.Idempotent(deployed)(controller.Create))
	mux.Handle("GET /api/v1/ads/boosts/{boostId}", authenticated(controller.Get))
	mux.Handle("POST /internal/v1/ads/boosts/{boostId}/payment-confirmed", middlewares.Internal(deployed)(controller.ConfirmPayment))
}
