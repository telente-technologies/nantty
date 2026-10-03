package routes

import (
	"net/http"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/middlewares"
	"zudomart/modules/inventory/src/modules/adjustments/controllers"
)

func MountAdjustmentsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.AdjustmentsController{Container: deployed}
	mux.Handle("GET /api/v1/seller/inventory/adjustments", middlewares.StoreMember(deployed, "inventory:manage", false)(controller.ListAdjustments))
	mux.Handle("POST /api/v1/seller/inventory/adjustments", middlewares.StoreMember(deployed, "inventory:manage", true)(controller.CreateAdjustments))
}
