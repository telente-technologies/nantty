package routes

import (
	"net/http"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/middlewares"
	"zudomart/modules/inventory/src/modules/transfers/controllers"
)

func MountTransfersRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.TransfersController{Container: deployed}
	reader := middlewares.StoreMemberFeature(deployed, "inventory:manage", "advanced_inventory", false)
	writer := middlewares.StoreMemberFeature(deployed, "inventory:manage", "advanced_inventory", true)
	mux.Handle("GET /api/v1/seller/inventory/transfers", reader(controller.ListTransfers))
	mux.Handle("POST /api/v1/seller/inventory/transfers", writer(controller.CreateTransfer))
	mux.Handle("POST /api/v1/seller/inventory/transfers/{transferId}/receive", writer(controller.ReceiveTransfer))
	mux.Handle("POST /api/v1/seller/inventory/transfers/{transferId}/cancel", writer(controller.CancelTransfer))
}
