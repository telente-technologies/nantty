package routes

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	"zudomart/modules/catalog/src/modules/featuredProducts/controllers"
)

func MountFeaturedProductsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.FeaturedProductsController{Container: deployed}
	manager := middlewares.StoreMemberFeature(deployed, "promotions:manage", "advanced_promotions", false)
	mux.Handle("GET /api/v1/seller/marketing/featured-products", manager(controller.List))
	mux.Handle("PUT /api/v1/seller/marketing/featured-products", manager(controller.Replace))
}
