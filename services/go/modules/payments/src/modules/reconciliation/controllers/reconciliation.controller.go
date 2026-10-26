package controllers

import (
	"net/http"

	"nantty/modules/payments/src/modules/gateway"
	reconcileproviderbalances "nantty/modules/payments/src/modules/reconciliation/commands/reconcileProviderBalances"
	"nantty/platform/httpserver"
)

type ReconciliationController struct {
	Application *gateway.Application
}

func (controller ReconciliationController) ReconcileProviderBalances(writer http.ResponseWriter, request *http.Request) {
	report, err := reconcileproviderbalances.Handler{Application: controller.Application}.Execute(request.Context(), reconcileproviderbalances.Command{})
	if err != nil && report.AccountsChecked == 0 {
		httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, report)
}
