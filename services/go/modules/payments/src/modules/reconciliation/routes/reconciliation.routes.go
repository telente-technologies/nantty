package routes

import (
	"net/http"

	"zudomart/modules/ledger/src/constants"
	"zudomart/modules/ledger/src/middlewares"
	"zudomart/modules/payments/src/modules/gateway"
	"zudomart/modules/payments/src/modules/reconciliation/controllers"
)

func MountReconciliationRoutes(mux *http.ServeMux, application *gateway.Application) {
	controller := controllers.ReconciliationController{Application: application}
	requireReconcile := middlewares.RequireStaffPermission(application.Container.Resources.StaffVerifiers, constants.PermissionReconcileProviders, false)
	mux.Handle("POST /api/v1/admin/payments/reconciliations", requireReconcile(http.HandlerFunc(controller.ReconcileProviderBalances)))
}
