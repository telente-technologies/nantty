package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/geo/controllers"
)

func MountGeoRoutes(mux *http.ServeMux, c *container.Container) {
	controller := controllers.GeoController{Container: c}
	mux.HandleFunc("GET /api/v1/geo/countries", controller.ListCountries)
	mux.HandleFunc("GET /api/v1/geo/countries/{countryId}/regions", controller.ListRegions)
	mux.HandleFunc("GET /api/v1/geo/regions/{regionId}/admin-areas", controller.ListAdminAreas)
	mux.HandleFunc("GET /api/v1/geo/regions/{regionId}/cities", controller.ListCitiesOfRegion)
	mux.HandleFunc("GET /api/v1/geo/admin-areas/{areaId}/cities", controller.ListCitiesOfAdminArea)
}
