package routes

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/middlewares"
	"zudomart/modules/orders/src/modules/sellerOrders/controllers"
)

func MountSellerOrdersRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.SellerOrdersController{Container: deployed}
	viewer := middlewares.StoreMember(deployed, "orders:view", false)
	manager := middlewares.StoreMember(deployed, "orders:manage", false)
	idempotentManager := middlewares.StoreMember(deployed, "orders:manage", true)
	delivery := middlewares.StoreMember(deployed, "delivery:manage", false)
	mux.Handle("GET /api/v1/seller/orders", viewer(controller.ListOrders))
	mux.Handle("GET /api/v1/seller/orders/{orderId}", viewer(controller.GetOrder))
	mux.Handle("GET /api/v1/seller/orders/{orderId}/shipping-snapshot", viewer(controller.GetShippingSnapshot))
	mux.Handle("POST /api/v1/seller/orders/{orderId}/accept", manager(controller.Accept))
	mux.Handle("POST /api/v1/seller/orders/{orderId}/reject", manager(controller.Reject))
	mux.Handle("POST /api/v1/seller/orders/{orderId}/status", manager(controller.ChangeStatus))
	mux.Handle("POST /api/v1/seller/orders/{orderId}/fulfilment", idempotentManager(controller.Ship))
	mux.Handle("POST /api/v1/seller/orders/{orderId}/cancel", manager(controller.Cancel))
	mux.Handle("POST /api/v1/seller/orders/{orderId}/notes", manager(controller.AddNote))
	mux.Handle("GET /api/v1/seller/delivery/summary", delivery(controller.GetDeliverySummary))
	mux.Handle("GET /api/v1/seller/delivery/shipments", delivery(controller.ListShipments))
	mux.Handle("PATCH /api/v1/seller/delivery/shipments/{orderId}", delivery(controller.PatchShipment))
	mux.Handle("POST /api/v1/seller/delivery/shipments/{orderId}/attempts", delivery(controller.RecordAttempt))
}
