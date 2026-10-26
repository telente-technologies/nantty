package routes

import (
	"net/http"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/middlewares"
	"nantty/modules/ads/src/modules/tracking/controllers"
)

func MountTrackingRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.TrackingController{Container: deployed}
	mux.Handle("POST /api/v1/ads/events", middlewares.Authenticated(deployed)(controller.RecordEvents))
	mux.HandleFunc("GET /api/v1/ads/r/{token}", controller.RedirectClick)
	mux.Handle("POST /internal/v1/ads/conversions", middlewares.Internal(deployed)(controller.RecordConversion))
}
