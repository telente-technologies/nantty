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
	mux.Handle("GET /api/v1/ads/boosts", authenticated(controller.List))
	mux.Handle("GET /api/v1/ads/boosts/{boostId}", authenticated(controller.Get))
	mux.Handle("GET /api/v1/ads/boosts/{boostId}/report", authenticated(controller.Report))
	mux.Handle("POST /api/v1/ads/boosts/{boostId}/pause", authenticated(controller.Pause))
	mux.Handle("POST /api/v1/ads/boosts/{boostId}/resume", authenticated(controller.Resume))
	mux.Handle("POST /api/v1/ads/boosts/{boostId}/budget/quote", authenticated(controller.QuoteBudget))
	mux.Handle("POST /api/v1/ads/boosts/{boostId}/budget", middlewares.Idempotent(deployed)(controller.ChangeBudget))
	mux.Handle("POST /api/v1/ads/boosts/{boostId}/cancel", middlewares.Idempotent(deployed)(controller.Cancel))
	mux.Handle("POST /internal/v1/ads/boosts/{boostId}/payment-confirmed", middlewares.Internal(deployed)(controller.ConfirmPayment))
}
