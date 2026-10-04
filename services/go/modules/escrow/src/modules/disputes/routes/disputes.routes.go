package routes

import (
	"net/http"

	"zudomart/modules/escrow/src/modules/disputes/controllers"
	"zudomart/modules/escrow/src/modules/escrows"
	"zudomart/modules/ledger/src/constants"
	"zudomart/modules/ledger/src/middlewares"
)

func MountDisputesRoutes(mux *http.ServeMux, application *escrows.Application) {
	controller := controllers.DisputesController{Application: application}
	resources := application.Container.Resources
	requireUser := middlewares.RequireUserAccessToken(resources.AccessVerifier)
	requireStaffRead := middlewares.RequireStaffPermission(resources.StaffVerifiers, constants.PermissionResolveDisputes, false)
	requireStaffDecision := middlewares.RequireStaffPermission(resources.StaffVerifiers, constants.PermissionResolveDisputes, true)
	mux.Handle("POST /api/v1/orders/{orderId}/disputes", requireUser(http.HandlerFunc(controller.OpenDispute)))
	mux.Handle("GET /api/v1/disputes", requireUser(http.HandlerFunc(controller.ListDisputes)))
	mux.Handle("GET /api/v1/disputes/{disputeId}", requireUser(http.HandlerFunc(controller.GetDispute)))
	mux.Handle("POST /api/v1/disputes/{disputeId}/messages", requireUser(http.HandlerFunc(controller.PostDisputeMessage)))
	mux.Handle("POST /api/v1/disputes/{disputeId}/close", requireUser(http.HandlerFunc(controller.CloseDispute)))
	mux.Handle("GET /api/v1/internal/stores/{storeId}/disputes", controller.RequireInternalToken(controller.ListStoreDisputes))
	mux.Handle("GET /api/v1/internal/stores/{storeId}/disputes/{disputeId}", controller.RequireInternalToken(controller.GetStoreDispute))
	mux.Handle("POST /api/v1/internal/stores/{storeId}/disputes/{disputeId}/responses", controller.RequireInternalToken(controller.RespondToStoreDispute))
	mux.Handle("GET /api/v1/admin/disputes", requireStaffRead(http.HandlerFunc(controller.ListDisputes)))
	mux.Handle("GET /api/v1/admin/disputes/{disputeId}", requireStaffRead(http.HandlerFunc(controller.GetDispute)))
	mux.Handle("POST /api/v1/admin/disputes/{disputeId}/messages", requireStaffRead(http.HandlerFunc(controller.PostSupportDisputeMessage)))
	mux.Handle("POST /api/v1/admin/disputes/{disputeId}/resolve", requireStaffDecision(http.HandlerFunc(controller.ResolveDispute)))
}
