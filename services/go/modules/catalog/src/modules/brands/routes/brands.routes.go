package routes

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/middlewares"
	"nantty/modules/catalog/src/modules/brands/controllers"
	"nantty/platform/jwtauth"
)

func MountBrandsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.BrandsController{Container: deployed}
	optional := middlewares.OptionallyAuthenticated(deployed)
	mux.Handle("GET /api/v1/brands", http.HandlerFunc(controller.ListBrands))
	mux.Handle("POST /api/v1/brands", middlewares.Idempotent(deployed)(controller.CreateBrand))
	mux.Handle("GET /api/v1/brands/{brandId}", optional(controller.GetBrand))
	mux.Handle("PATCH /api/v1/brands/{brandId}", middlewares.Authenticated(deployed)(jwtauth.RequireUserStepUp(deployed.AccessVerifier)(http.HandlerFunc(controller.UpdateBrand)).ServeHTTP))
	mux.Handle("POST /api/v1/brands/{brandId}/storefront", middlewares.Idempotent(deployed)(controller.CreateStorefront))
	mux.Handle("GET /api/v1/brands/{brandId}/products", optional(controller.ListBrandProducts))
}
