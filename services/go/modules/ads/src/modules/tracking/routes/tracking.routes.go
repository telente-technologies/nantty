package routes

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/middlewares"
	"zudomart/modules/ads/src/modules/tracking/controllers"
)

func MountTrackingRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.TrackingController{Container: deployed}
	mux.Handle("POST /api/v1/ads/events", middlewares.Authenticated(deployed)(controller.RecordEvents))
	mux.Handle("POST /internal/v1/ads/conversions", middlewares.Internal(deployed)(controller.RecordConversion))
}
