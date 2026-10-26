package controllers

import (
	"net/http"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/wallet/src/modules/adBalances/dtos"
	"nantty/modules/wallet/src/modules/adBalances/services"
	"nantty/platform/httpserver"
)

func (controller AdBalancesController) FundFromEarnings(writer http.ResponseWriter, request *http.Request) {
	if !controller.requireInternalToken(writer, request) {
		return
	}
	adAccountId := request.PathValue("adAccountId")
	key, err := ledgerutils.ReadRequiredIdempotencyKey(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.EarningsFundingRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		if !adIdentifierPattern.MatchString(adAccountId) {
			collector.Add("adAccountId", "has an invalid format")
		}
		if !adIdempotencyPattern.MatchString(key) {
			collector.Add("idempotencyKey", "has an invalid format")
		}
		collector.RequireLength("userId", body.UserId, 1, 80)
		collector.RequireRange("amount.amountMinor", body.Amount.AmountMinor, 1, 1_000_000_000)
		collector.RequireOneOf("amount.currency", body.Amount.Currency, "NGN")
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	funded, err := controller.Balances.FundFromEarnings(request.Context(), services.EarningsFundingRequest{
		UserId: body.UserId, AdAccountId: adAccountId, Amount: body.Amount, IdempotencyKey: key, AnnounceTopUp: true,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	status := http.StatusCreated
	if funded.Replayed {
		status = http.StatusOK
	}
	httpserver.WriteJsonResponse(writer, status, funded)
}

func (controller AdBalancesController) DebitEarningsForBoost(writer http.ResponseWriter, request *http.Request) {
	if !controller.requireInternalToken(writer, request) {
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.BoostDebitRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("userId", body.UserId, 1, 80)
		collector.RequireRange("amount.amountMinor", body.Amount.AmountMinor, 1, 10_000_000_000)
		collector.RequireOneOf("amount.currency", body.Amount.Currency, "NGN")
		if !adIdempotencyPattern.MatchString(body.IdempotencyKey) {
			collector.Add("idempotencyKey", "has an invalid format")
		}
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	result, err := controller.Balances.DebitEarningsForBoost(request.Context(), body)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}
