package routes

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/middlewares"
	"zudomart/modules/orders/src/modules/cart/controllers"
)

func MountCartRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.CartController{Container: deployed}
	signedIn := middlewares.Authenticated(deployed)
	mux.Handle("GET /api/v1/cart", signedIn(controller.GetCart))
	mux.Handle("DELETE /api/v1/cart", signedIn(controller.ClearCart))
	mux.Handle("POST /api/v1/cart/shipping-quote", signedIn(controller.GetShippingQuote))
	mux.Handle("POST /api/v1/cart/items", signedIn(controller.AddItem))
	mux.Handle("PATCH /api/v1/cart/items/{itemId}", signedIn(controller.ChangeQuantity))
	mux.Handle("DELETE /api/v1/cart/items/{itemId}", signedIn(controller.RemoveItem))
}
