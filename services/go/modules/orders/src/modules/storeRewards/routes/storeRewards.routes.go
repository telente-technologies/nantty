package routes

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/middlewares"
	"nantty/modules/orders/src/modules/storeRewards/controllers"
)

func MountStoreRewardsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.StoreRewardsController{Container: deployed}
	manager := middlewares.StoreMember(deployed, "promotions:manage", false)
	mux.Handle("GET /api/v1/store-rewards/me", middlewares.Authenticated(deployed)(controller.ListMyBalances))
	mux.Handle("GET /api/v1/seller/marketing/rewards/summary", manager(controller.GetSummary))
	mux.Handle("GET /api/v1/seller/marketing/rewards/settings", manager(controller.GetSettings))
	mux.Handle("PUT /api/v1/seller/marketing/rewards/settings", manager(controller.PutSettings))
}
