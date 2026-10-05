package routes

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	"zudomart/modules/catalog/src/modules/martFeatures/controllers"
)

func MountMartFeaturesRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.MartFeaturesController{Container: deployed}
	manage := middlewares.Staff(deployed, "catalog:manage")
	mux.Handle("GET /api/v1/mart/highlights", middlewares.OptionallyAuthenticated(deployed)(controller.Highlights))
	mux.Handle("GET /api/v1/admin/catalog/features", manage(controller.List))
	mux.Handle("POST /api/v1/admin/catalog/features", manage(controller.Create))
	mux.Handle("GET /api/v1/admin/catalog/features/image-library", manage(controller.ImageLibrary))
	mux.Handle("GET /api/v1/admin/catalog/features/{featureId}", manage(controller.Get))
	mux.Handle("PATCH /api/v1/admin/catalog/features/{featureId}", manage(controller.Update))
	mux.Handle("POST /api/v1/admin/catalog/features/{featureId}/publish", manage(controller.Publish))
	mux.Handle("POST /api/v1/admin/catalog/features/{featureId}/unpublish", manage(controller.Unpublish))
	mux.Handle("POST /api/v1/admin/catalog/features/{featureId}/move", manage(controller.Move))
}
