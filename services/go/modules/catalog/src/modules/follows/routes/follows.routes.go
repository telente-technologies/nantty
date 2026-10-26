package routes

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/middlewares"
	setfollow "nantty/modules/catalog/src/modules/follows/commands/setFollow"
	"nantty/modules/catalog/src/modules/follows/controllers"
)

func MountFollowsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.FollowsController{Container: deployed}
	signedIn := middlewares.OptionallyIdempotent(deployed)
	mux.Handle("POST /api/v1/brands/{brandId}/follow", signedIn(controller.Set(setfollow.TargetBrand, "brandId", true)))
	mux.Handle("DELETE /api/v1/brands/{brandId}/follow", signedIn(controller.Set(setfollow.TargetBrand, "brandId", false)))
}
