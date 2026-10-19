package controllers

import (
	"net/http"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/wallet/src/modules/adBalances/dtos"
	"zudomart/platform/httpserver"
)

func (controller AdBalancesController) WithdrawAdBalanceToWallet(writer http.ResponseWriter, request *http.Request) {
	if !controller.requireInternalToken(writer, request) {
		return
	}
	adAccountId := request.PathValue("adAccountId")
	if !adIdentifierPattern.MatchString(adAccountId) {
		controller.fail(writer, request, httpserver.ErrNotFound)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.AdBalanceWithdrawalRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("userId", body.UserId, 1, 80)
		collector.RequireLength("currency", body.Currency, 3, 3)
		collector.RequireRange("grossMinor", body.GrossMinor, 1, 10_000_000_000)
		collector.RequireRange("feeMinor", body.FeeMinor, 0, body.GrossMinor)
		collector.RequireLength("idempotencyKey", body.IdempotencyKey, 8, 140)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	result, err := controller.Balances.WithdrawAdBalanceToWallet(request.Context(), adAccountId, body)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}
