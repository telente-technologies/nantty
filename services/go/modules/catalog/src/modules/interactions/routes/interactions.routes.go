package routes

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	"zudomart/modules/catalog/src/modules/interactions/controllers"
)

func MountInteractionsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.InteractionsController{Container: deployed}
	mux.Handle("POST /api/v1/analytics/product-interactions", middlewares.OptionallyAuthenticated(deployed)(controller.RecordInteractions))
}
