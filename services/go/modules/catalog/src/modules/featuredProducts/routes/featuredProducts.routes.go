package routes

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/middlewares"
	"nantty/modules/catalog/src/modules/featuredProducts/controllers"
)

func MountFeaturedProductsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.FeaturedProductsController{Container: deployed}
	manager := middlewares.StoreMemberFeature(deployed, "promotions:manage", "advanced_promotions", false)
	mux.Handle("GET /api/v1/seller/marketing/featured-products", manager(controller.List))
	mux.Handle("PUT /api/v1/seller/marketing/featured-products", manager(controller.Replace))
	mux.Handle("GET /api/v1/seller/marketing/product-options", middlewares.StoreMember(deployed, "promotions:manage", false)(controller.ProductOptions))
}
