package controllers

import (
	"net/http"
	"time"

	"zudomart/modules/ledger/src/utils"
	"zudomart/modules/payments/src/modules/gateway"
	"zudomart/modules/payments/src/modules/reconciliation/commands/reconcileProviderSettlements"
	"zudomart/modules/payments/src/modules/reconciliation/dtos"
	"zudomart/platform/httpserver"
)

type ReconciliationController struct {
	Application *gateway.Application
}

func (controller ReconciliationController) ReconcileProviderSettlements(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidateJsonBody(writer, request, func(body dtos.ReconcileProviderSettlementsRequestDto) error {
		collector := &utils.IssueCollector{}
		collector.RequireOneOf("provider", body.Provider, "paystack", "flutterwave")
		if !body.To.After(body.From) || body.To.Sub(body.From) > 31*24*time.Hour {
			collector.Add("to", "must be after from and within 31 days")
		}
		return collector.Result()
	})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
		return
	}
	report, err := reconcileprovidersettlements.Handler{Application: controller.Application}.Execute(request.Context(), reconcileprovidersettlements.Command{Provider: body.Provider, From: body.From, To: body.To})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, report)
}
