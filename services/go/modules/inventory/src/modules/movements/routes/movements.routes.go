package routes

import (
	"net/http"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/middlewares"
	"zudomart/modules/inventory/src/modules/movements/controllers"
)

func MountMovementsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.MovementsController{Container: deployed}
	mux.Handle("GET /api/v1/seller/inventory/movements", middlewares.StoreMemberFeature(deployed, "inventory:manage", "advanced_inventory", false)(controller.ListMovements))
}
