package routes

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/shareCards/controllers"
)

func MountShareCardsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.ShareCardsController{Container: deployed}
	mux.Handle("GET /api/v1/internal/share-cards/{kind}/{id}", controller.RequireInternalToken(controller.GetShareCard))
}
