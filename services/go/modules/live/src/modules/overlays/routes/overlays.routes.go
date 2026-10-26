package routes

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/middlewares"
	"nantty/modules/live/src/modules/overlays/controllers"
)

func MountOverlaysRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.OverlaysController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	mux.Handle("GET /api/v1/lives/{liveId}/overlays", authenticated(controller.GetMainScene))
	mux.Handle("PUT /api/v1/lives/{liveId}/overlays", authenticated(controller.SaveMainScene))
	mux.Handle("GET /api/v1/lives/{liveId}/overlay-scenes", authenticated(controller.ListScenes))
	mux.Handle("POST /api/v1/lives/{liveId}/overlay-scenes", authenticated(controller.CreateScene))
	mux.Handle("GET /api/v1/lives/{liveId}/overlay-scenes/{sceneId}", authenticated(controller.GetScene))
	mux.Handle("PUT /api/v1/lives/{liveId}/overlay-scenes/{sceneId}", authenticated(controller.UpdateScene))
	mux.Handle("DELETE /api/v1/lives/{liveId}/overlay-scenes/{sceneId}", authenticated(controller.DeleteScene))
	mux.Handle("POST /api/v1/lives/{liveId}/overlay-scenes/{sceneId}/publish", authenticated(controller.PublishScene))
	mux.Handle("DELETE /api/v1/lives/{liveId}/overlay-scenes/{sceneId}/publish", authenticated(controller.UnpublishScene))
	mux.HandleFunc("GET /api/v1/overlay-scenes/{sceneId}", controller.GetPublicScene)
}
