package routes

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	"zudomart/modules/catalog/src/modules/products/controllers"
)

func MountProductsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.ProductsController{Container: deployed}
	optional := middlewares.OptionallyAuthenticated(deployed)
	signedIn := middlewares.Authenticated(deployed)
	mux.Handle("GET /api/v1/mart/home", optional(controller.GetMartHome))
	mux.Handle("GET /api/v1/products", optional(controller.ListProducts))
	mux.Handle("GET /api/v1/products/featured", optional(controller.ListFeaturedProducts))
	mux.Handle("GET /api/v1/products/{productId}", optional(controller.GetProduct))
	mux.Handle("GET /api/v1/stores/{storeId}/products", optional(controller.ListStoreProducts))
	mux.Handle("POST /api/v1/products/{productId}/like", signedIn(controller.LikeProduct))
	mux.Handle("DELETE /api/v1/products/{productId}/like", signedIn(controller.UnlikeProduct))
	mux.Handle("POST /api/v1/products/{productId}/bookmark", signedIn(controller.BookmarkProduct))
	mux.Handle("DELETE /api/v1/products/{productId}/bookmark", signedIn(controller.UnbookmarkProduct))
}
