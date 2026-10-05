package routes

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/middlewares"
	"zudomart/modules/orders/src/modules/adminOrders/controllers"
)

var orderReaders = []string{"orders:read", "disputes:resolve", "refunds:issue", "support:tickets"}
var refundIssuers = []string{"refunds:issue"}

func MountAdminOrdersRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.AdminOrdersController{Container: deployed}
	readOrders := middlewares.StaffWithAnyPermission(deployed, orderReaders, false)
	readRefunds := middlewares.StaffWithAnyPermission(deployed, refundIssuers, false)
	issueRefunds := middlewares.StaffWithAnyPermission(deployed, refundIssuers, true)
	mux.Handle("GET /api/v1/admin/orders", readOrders(controller.ListOrders))
	mux.Handle("GET /api/v1/admin/orders/{orderIdOrNumber}", readOrders(controller.GetOrder))
	mux.Handle("GET /api/v1/admin/refunds", readRefunds(controller.ListRefunds))
	mux.Handle("POST /api/v1/admin/refunds", issueRefunds(controller.IssueRefund))
}
