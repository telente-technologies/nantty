package routes

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/middlewares"
	"nantty/modules/catalog/src/modules/stores/controllers"
)

func MountStoresRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.StoresController{Container: deployed}
	mux.Handle("POST /api/v1/stores", middlewares.Idempotent(deployed)(controller.CreateStore))
	mux.Handle("GET /api/v1/stores/{storeId}", middlewares.OptionallyAuthenticated(deployed)(controller.GetStore))
	mux.Handle("GET /api/v1/seller/access", middlewares.Authenticated(deployed)(controller.GetSellerAccess))
	mux.Handle("GET /api/v1/seller/stores/mine", middlewares.Authenticated(deployed)(controller.ListMyStores))
	mux.Handle("POST /api/v1/admin/stores/{storeId}/status", middlewares.StaffWithAnyPermission(deployed, []string{"users:suspend", "moderation:reports"}, true)(controller.SetStoreStatus))
	mux.Handle("PATCH /api/v1/seller/store", middlewares.StoreMember(deployed, "settings:manage", false)(controller.UpdateStore))
}
