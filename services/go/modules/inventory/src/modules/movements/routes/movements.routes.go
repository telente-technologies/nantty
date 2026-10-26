package routes

import (
	"net/http"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/middlewares"
	"nantty/modules/inventory/src/modules/movements/controllers"
)

func MountMovementsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.MovementsController{Container: deployed}
	mux.Handle("GET /api/v1/seller/inventory/movements", middlewares.StoreMemberFeature(deployed, "inventory:manage", "advanced_inventory", false)(controller.ListMovements))
}
