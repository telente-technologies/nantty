package routes

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	"zudomart/modules/catalog/src/modules/internalSources/controllers"
)

func MountInternalSourcesRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.InternalSourcesController{Container: deployed}
	internal := middlewares.RequireInternalToken(deployed)
	mux.Handle("GET /api/v1/internal/search-sources/{collection}/{id}", internal(controller.GetSearchSource))
	mux.Handle("GET /api/v1/internal/moderation/targets/{type}/{id}", internal(controller.GetModerationTarget))
	mux.Handle("GET /api/v1/internal/audience-sources/stores/{storeId}/visitors", internal(controller.ListStoreVisitors))
	mux.Handle("GET /internal/v1/stores/{storeId}/members/{userId}", internal(controller.GetStoreMembership))
	mux.Handle("POST /internal/v1/stores/{storeId}/products/ownership", internal(controller.ResolveProductOwnership))
}
