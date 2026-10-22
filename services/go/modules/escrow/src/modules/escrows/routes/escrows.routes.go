package routes

import (
	"net/http"

	"zudomart/modules/escrow/src/modules/escrows"
	"zudomart/modules/escrow/src/modules/escrows/controllers"
	"zudomart/modules/ledger/src/constants"
	"zudomart/modules/ledger/src/middlewares"
	"zudomart/platform/httpserver"
)

func MountEscrowsRoutes(mux *http.ServeMux, application *escrows.Application) {
	controller := controllers.EscrowsController{Application: application}
	internalToken := httpserver.RequireInternalToken(application.Container.Settings.InternalApiToken)
	resources := application.Container.Resources
	requireUser := middlewares.RequireUserAccessToken(resources.AccessVerifier)
	requireStaffRead := middlewares.RequireStaffPermission(resources.StaffVerifiers, constants.PermissionResolveDisputes, false)
	requireStaffRefund := middlewares.RequireStaffPermissionWithSingleUseStepUp(resources.StaffVerifiers, constants.PermissionResolveDisputes)
	mux.Handle("GET /api/v1/orders/{orderId}/escrow", requireUser(http.HandlerFunc(controller.GetEscrowForOrder)))
	mux.Handle("GET /api/v1/wallets/me/escrow-holds", requireUser(http.HandlerFunc(controller.ListMyEscrowHolds)))
	mux.Handle("GET /api/v1/admin/orders/{orderId}/escrow", requireStaffRead(http.HandlerFunc(controller.GetEscrowForOrder)))
	mux.Handle("POST /api/v1/internal/order-groups/{orderGroupId}/refunds", internalToken(http.HandlerFunc(controller.RefundOrderGroupForCommerce)))
	mux.Handle("POST /api/v1/admin/orders/{orderId}/escrow/refund", requireStaffRefund(http.HandlerFunc(controller.RefundEscrowByStaff)))
	mux.Handle("POST /api/v1/admin/orders/{orderId}/escrow/release", requireStaffRefund(http.HandlerFunc(controller.ReleaseEscrowByStaff)))
	mux.Handle("GET /api/v1/admin/escrows/undelivered-review", requireStaffRead(http.HandlerFunc(controller.ListUndeliveredReview)))
}
