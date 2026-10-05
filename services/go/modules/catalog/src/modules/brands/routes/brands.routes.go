package routes

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	"zudomart/modules/catalog/src/modules/brands/controllers"
)

func MountBrandsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.BrandsController{Container: deployed}
	optional := middlewares.OptionallyAuthenticated(deployed)
	mux.Handle("GET /api/v1/brands", http.HandlerFunc(controller.ListBrands))
	mux.Handle("POST /api/v1/brands", middlewares.Idempotent(deployed)(controller.CreateBrand))
	mux.Handle("GET /api/v1/brands/{brandId}", optional(controller.GetBrand))
	mux.Handle("GET /api/v1/brands/{brandId}/products", optional(controller.ListBrandProducts))
}
