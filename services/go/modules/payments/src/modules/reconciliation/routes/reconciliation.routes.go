package routes

import (
	"net/http"

	"nantty/modules/ledger/src/constants"
	"nantty/modules/ledger/src/middlewares"
	"nantty/modules/payments/src/modules/gateway"
	"nantty/modules/payments/src/modules/reconciliation/controllers"
)

func MountReconciliationRoutes(mux *http.ServeMux, application *gateway.Application) {
	controller := controllers.ReconciliationController{Application: application}
	requireReconcile := middlewares.RequireStaffPermission(application.Container.Resources.StaffVerifiers, constants.PermissionReconcileProviders, false)
	mux.Handle("POST /api/v1/admin/payments/reconciliations", requireReconcile(http.HandlerFunc(controller.ReconcileProviderBalances)))
}
