package routes

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/middlewares"
	"zudomart/modules/ads/src/modules/decision/controllers"
)

func MountDecisionRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.DecisionController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	internal := middlewares.Internal(deployed)
	mux.Handle("POST /api/v1/ads/decide", authenticated(controller.DecideForSignedInViewer))
	mux.Handle("POST /internal/v1/ads/decide", internal(controller.DecideForTrustedCaller))
	mux.Handle("PUT /internal/v1/ads/content-signals", internal(controller.UpsertContentSignal))
}
