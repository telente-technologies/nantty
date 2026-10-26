package routes

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/middlewares"
	"nantty/modules/catalog/src/modules/interactions/controllers"
)

func MountInteractionsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.InteractionsController{Container: deployed}
	mux.Handle("POST /api/v1/analytics/product-interactions", middlewares.OptionallyAuthenticated(deployed)(controller.RecordInteractions))
}
