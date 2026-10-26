package routes

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/middlewares"
	"nantty/modules/catalog/src/modules/storeSettings/controllers"
)

func MountStoreSettingsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.StoreSettingsController{Container: deployed}
	mux.Handle("GET /api/v1/seller/settings", middlewares.StoreMember(deployed, "settings:view", false)(controller.GetSettings))
	mux.Handle("PATCH /api/v1/seller/settings", middlewares.StoreMemberWithOptionalKey(deployed, "settings:manage")(controller.PatchSettings))
	mux.Handle("GET /api/v1/seller/storefront", middlewares.StoreMember(deployed, "storefront:manage", false)(controller.GetStorefront))
	mux.Handle("PATCH /api/v1/seller/storefront", middlewares.StoreMemberWithOptionalKey(deployed, "storefront:manage")(controller.PatchStorefront))
}
