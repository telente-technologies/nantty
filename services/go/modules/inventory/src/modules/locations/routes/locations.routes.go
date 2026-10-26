package routes

import (
	"net/http"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/middlewares"
	"nantty/modules/inventory/src/modules/locations/controllers"
)

func MountLocationsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.LocationsController{Container: deployed}
	viewer := middlewares.StoreMember(deployed, "settings:view", false)
	manager := middlewares.StoreMember(deployed, "settings:manage", false)
	mux.Handle("GET /api/v1/seller/locations", viewer(controller.ListLocations))
	mux.Handle("POST /api/v1/seller/locations", manager(controller.CreateLocation))
	mux.Handle("PATCH /api/v1/seller/locations/{locationId}", manager(controller.UpdateLocation))
}
