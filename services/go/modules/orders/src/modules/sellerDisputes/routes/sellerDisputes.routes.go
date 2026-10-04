package routes

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/integrations"
	"zudomart/modules/orders/src/middlewares"
	"zudomart/modules/orders/src/modules/sellerDisputes/controllers"
)

func MountSellerDisputesRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.SellerDisputesController{Container: deployed, Money: integrations.NewMoneyDisputesClient(deployed.Settings.MoneyInternalUrl, deployed.Settings.MoneyInternalToken)}
	viewer := middlewares.StoreMember(deployed, "orders:view", false)
	manager := middlewares.StoreMember(deployed, "orders:manage", true)
	mux.Handle("GET /api/v1/seller/disputes", viewer(controller.List))
	mux.Handle("GET /api/v1/seller/disputes/{disputeId}", viewer(controller.Get))
	mux.Handle("POST /api/v1/seller/disputes/{disputeId}/responses", manager(controller.Respond))
}
