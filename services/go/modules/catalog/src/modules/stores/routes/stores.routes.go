package routes

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	"zudomart/modules/catalog/src/modules/stores/controllers"
)

func MountStoresRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.StoresController{Container: deployed}
	mux.Handle("POST /api/v1/stores", middlewares.Idempotent(deployed)(controller.CreateStore))
	mux.Handle("GET /api/v1/stores/{storeId}", http.HandlerFunc(controller.GetStore))
	mux.Handle("GET /api/v1/seller/access", middlewares.Authenticated(deployed)(controller.GetSellerAccess))
	mux.Handle("GET /api/v1/seller/stores/mine", middlewares.Authenticated(deployed)(controller.GetSellerAccess))
	mux.Handle("PATCH /api/v1/seller/store", middlewares.StoreMember(deployed, "settings:manage", false)(controller.UpdateStore))
}
