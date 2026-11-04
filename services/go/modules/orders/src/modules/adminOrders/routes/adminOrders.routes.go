package routes

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/middlewares"
	"nantty/modules/orders/src/modules/adminOrders/controllers"
)

var orderReaders = []string{"orders:read", "disputes:resolve", "refunds:issue", "support:tickets"}
var refundIssuers = []string{"refunds:issue"}

func MountAdminOrdersRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.AdminOrdersController{Container: deployed}
	readOrders := middlewares.StaffWithAnyPermission(deployed, orderReaders, false)
	readLogistics := middlewares.StaffWithAnyPermission(deployed, []string{"logistics:read"}, false)
	readRefunds := middlewares.StaffWithAnyPermission(deployed, refundIssuers, false)
	issueRefunds := middlewares.StaffWithAnyPermission(deployed, refundIssuers, true)
	mux.Handle("GET /api/v1/admin/orders", readOrders(controller.ListOrders))
	mux.Handle("GET /api/v1/admin/orders/{orderIdOrNumber}", readOrders(controller.GetOrder))
	mux.Handle("GET /api/v1/admin/refunds", readRefunds(controller.ListRefunds))
	mux.Handle("GET /api/v1/admin/logistics/shipments", readLogistics(controller.ListLogisticsShipments))
	mux.Handle("POST /api/v1/admin/refunds", issueRefunds(controller.IssueRefund))
}
