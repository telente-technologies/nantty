package routes

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/middlewares"
	"nantty/modules/catalog/src/modules/shareCards/controllers"
)

func MountShareCardsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.ShareCardsController{Container: deployed}
	mux.Handle("GET /api/v1/internal/share-cards/{kind}/{id}", middlewares.RequireInternalToken(deployed)(controller.GetShareCard))
}
