package routes

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	setfollow "zudomart/modules/catalog/src/modules/follows/commands/setFollow"
	"zudomart/modules/catalog/src/modules/follows/controllers"
)

func MountFollowsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.FollowsController{Container: deployed}
	signedIn := middlewares.OptionallyIdempotent(deployed)
	mux.Handle("POST /api/v1/brands/{brandId}/follow", signedIn(controller.Set(setfollow.TargetBrand, "brandId", true)))
	mux.Handle("DELETE /api/v1/brands/{brandId}/follow", signedIn(controller.Set(setfollow.TargetBrand, "brandId", false)))
}
