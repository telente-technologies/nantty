package routes

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/middlewares"
	"zudomart/modules/orders/src/modules/internalSources/controllers"
)

func MountInternalSourcesRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.InternalSourcesController{Container: deployed}
	mux.Handle("GET /api/v1/internal/audience-sources/stores/{storeId}/purchasers", middlewares.RequireInternalToken(deployed)(controller.ListStorePurchasers))
	mux.Handle("GET /internal/v1/buyers/{userId}/stores", middlewares.RequireInternalToken(deployed)(controller.ListBuyerStores))
	mux.Handle("GET /api/v1/internal/buyers/{userId}/stores", middlewares.RequireInternalToken(deployed)(controller.ListBuyerStores))
}
