package controllers

import (
	"context"
	"database/sql"
	"net/http"

	"github.com/google/uuid"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/wallet/src/modules/adBalances/dtos"
	"nantty/platform/httpserver"
)

func (controller AdBalancesController) StartTopUpForAdAccount(writer http.ResponseWriter, request *http.Request) {
	if !controller.requireInternalToken(writer, request) {
		return
	}
	adAccountId := request.PathValue("adAccountId")
	key, err := ledgerutils.ReadRequiredIdempotencyKey(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.InternalStartTopUpRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		if !adIdentifierPattern.MatchString(adAccountId) {
			collector.Add("adAccountId", "has an invalid format")
		}
		collector.RequireLength("userId", body.UserId, 1, 80)
		collector.RequireRange("amount.amountMinor", body.Amount.AmountMinor, 100_000, 1_000_000_000)
		collector.RequireOneOf("amount.currency", body.Amount.Currency, "NGN")
		collector.RequireLength("returnTo", body.ReturnTo, 0, 300)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if !controller.Container.Payments.IsAllowedReturnUrl(body.ReturnTo) {
		controller.fail(writer, request, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "returnTo", Message: "is not an allowed return URL"}}))
		return
	}
	start := dtos.StartTopUpRequestDto{AdAccountId: adAccountId, Amount: body.Amount, ReturnTo: body.ReturnTo}
	var intentId uuid.UUID
	topUp, replayed, err := ledgerutils.RunIdempotentMoneyCommand(request.Context(), controller.Container.Resources.Database, controller.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.TopUpDto]{
		Scope: "ads:" + adAccountId + ":topUp", Key: key, RequestHash: ledgerutils.HashRequestFingerprint(body.UserId, body.Amount.AmountMinor, body.Amount.Currency, body.ReturnTo),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.TopUpDto, error) {
			created, id, err := controller.Balances.StartTopUpInTransaction(ctx, transaction, body.UserId, start)
			intentId = id
			return created, err
		},
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if intentId != uuid.Nil {
		opened, err := controller.Container.Payments.OpenProviderCheckoutForIntent(request.Context(), intentId)
		if err != nil {
			controller.fail(writer, request, err)
			return
		}
		topUp.CheckoutUrl = opened.CheckoutUrl
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusCreated, topUp, replayed)
}

func (controller AdBalancesController) GetTopUpForAdAccount(writer http.ResponseWriter, request *http.Request) {
	if !controller.requireInternalToken(writer, request) {
		return
	}
	adAccountId, reference := request.PathValue("adAccountId"), request.PathValue("reference")
	if !adIdentifierPattern.MatchString(adAccountId) || len(reference) == 0 || len(reference) > 80 {
		controller.fail(writer, request, httpserver.ErrNotFound)
		return
	}
	status, err := controller.Balances.ReadTopUpStatus(request.Context(), adAccountId, reference)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, status)
}
