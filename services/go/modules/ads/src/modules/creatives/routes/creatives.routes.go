package routes

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/middlewares"
	"zudomart/modules/ads/src/modules/creatives/controllers"
)

func MountCreativesRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.CreativesController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	const base = "/api/v1/ads/accounts/{accountId}"
	mux.Handle("GET "+base+"/content-sources", authenticated(controller.ListContentSources))
	mux.Handle("POST "+base+"/creatives/media/uploads", authenticated(controller.CreateMediaUpload))
	mux.Handle("POST "+base+"/creatives/media/{mediaId}/complete", authenticated(controller.CompleteMediaUpload))
	mux.Handle("GET "+base+"/creatives/media/{mediaId}", authenticated(controller.GetMedia))
	mux.Handle("POST /internal/v1/ads/media/{mediaId}/processed", middlewares.Internal(deployed)(controller.RecordMediaProcessed))
}
