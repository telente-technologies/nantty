package controllers

import (
	"crypto/subtle"
	"net/http"

	refundordergroup "nantty/modules/escrow/src/modules/escrows/commands/refundOrderGroup"
	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/platform/httpserver"
)

func (controller EscrowsController) RefundOrderGroupForCommerce(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Application.Container.Settings.InternalApiToken
	if len(expected) < 32 || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body refundordergroup.Command) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("orderGroupId", body.OrderGroupId, 1, 80)
		collector.RequireLength("buyerAccountId", body.BuyerAccountId, 1, 80)
		collector.RequireLength("reason", body.Reason, 1, 300)
		collector.RequireRange("amountMinor", body.AmountMinor, 1, 100_000_000_000)
		collector.RequireLength("currency", body.Currency, 3, 3)
		return collector.Result()
	})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
		return
	}
	if pathId := request.PathValue("orderGroupId"); pathId != "" && pathId != body.OrderGroupId {
		httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, refundordergroup.ErrRefundDoesNotMatchOrder)
		return
	}
	detail, replayed, err := refundordergroup.Handler{Application: controller.Application}.Execute(request.Context(), body)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
		return
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusOK, detail, replayed)
}
