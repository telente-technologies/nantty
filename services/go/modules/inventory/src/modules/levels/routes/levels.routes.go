package routes

import (
	"net/http"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/middlewares"
	"zudomart/modules/inventory/src/modules/levels/controllers"
)

func MountLevelsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.LevelsController{Container: deployed}
	manager := middlewares.StoreMember(deployed, "inventory:manage", false)
	advanced := middlewares.StoreMemberFeature(deployed, "inventory:manage", "advanced_inventory", false)
	mux.Handle("GET /api/v1/seller/inventory/levels", manager(controller.ListLevels))
	mux.Handle("GET /api/v1/seller/inventory/summary", manager(controller.GetSummary))
	mux.Handle("GET /api/v1/seller/inventory/locations", manager(controller.ListLocationSummaries))
	mux.Handle("GET /api/v1/seller/inventory/reorder", advanced(controller.ListReorderSuggestions))
	mux.Handle("PATCH /api/v1/seller/inventory/reorder-levels", advanced(controller.UpdateReorderLevels))
}
