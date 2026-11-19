package routes

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/middlewares"
	"nantty/modules/orders/src/modules/partnerLogistics/controllers"
)

func MountPartnerLogisticsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.PartnerLogisticsController{Container: deployed}
	reader := middlewares.StoreMember(deployed, "orders:view", false)
	writer := middlewares.StoreMember(deployed, "delivery:manage", true)

	mux.Handle("POST /api/v1/seller/delivery/partner/quote", writer(controller.Quote))
	mux.Handle("POST /api/v1/seller/delivery/partner/book", writer(controller.Book))
	mux.Handle("POST /api/v1/seller/delivery/partner/cancel", writer(controller.Cancel))
	mux.Handle("GET /api/v1/seller/delivery/partner/shipments/{shipmentId}", reader(controller.Track))
	mux.HandleFunc("POST /api/v1/logistics/webhooks/kwikpik", controller.KwikpikWebhook)
}
