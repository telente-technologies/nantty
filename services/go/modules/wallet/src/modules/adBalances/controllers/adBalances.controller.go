package controllers

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"net/http"
	"regexp"

	"github.com/google/uuid"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/wallet/src/container"
	"zudomart/modules/wallet/src/modules/adBalances/dtos"
	"zudomart/modules/wallet/src/modules/adBalances/services"
	"zudomart/platform/httpserver"
)

var (
	adIdentifierPattern  = regexp.MustCompile(`^[A-Za-z0-9_-]{1,80}$`)
	adIdempotencyPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{8,128}$`)
)

type AdBalancesController struct {
	Container *container.Container
	Balances  services.AdBalances
}

func (controller AdBalancesController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Container.Resources.Logger, err)
}

func (controller AdBalancesController) StartTopUp(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	key, err := ledgerutils.ReadRequiredIdempotencyKey(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.StartTopUpRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		if !adIdentifierPattern.MatchString(body.AdAccountId) {
			collector.Add("adAccountId", "has an invalid format")
		}
		collector.RequireRange("amount.amountMinor", body.Amount.AmountMinor, 100_000, 1_000_000_000)
		collector.RequireOneOf("amount.currency", body.Amount.Currency, "NGN")
		collector.RequireLength("returnTo", body.ReturnTo, 0, 300)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	var intentId uuid.UUID
	topUp, replayed, err := ledgerutils.RunIdempotentMoneyCommand(request.Context(), controller.Container.Resources.Database, controller.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.TopUpDto]{
		Scope: principal.UserId + ":ads.topUp", Key: key, RequestHash: ledgerutils.HashRequestFingerprint(body.AdAccountId, body.Amount.AmountMinor, body.Amount.Currency, body.ReturnTo),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.TopUpDto, error) {
			created, id, err := controller.Balances.StartTopUpInTransaction(ctx, transaction, principal.UserId, body)
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

func (controller AdBalancesController) GetBalance(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	adAccountId := request.URL.Query().Get("adAccountId")
	if adAccountId == "" {
		adAccountId = services.BoostAdAccountId(principal.UserId)
	}
	if !adIdentifierPattern.MatchString(adAccountId) && adAccountId != services.BoostAdAccountId(principal.UserId) {
		controller.fail(writer, request, httpserver.ErrNotFound)
		return
	}
	balance, err := controller.Balances.ReadBalance(request.Context(), principal.UserId, adAccountId, "NGN")
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, balance)
}

func (controller AdBalancesController) RefundUnusedBalance(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.StartTopUpRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		if !adIdentifierPattern.MatchString(body.AdAccountId) {
			collector.Add("adAccountId", "has an invalid format")
		}
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	refunded, err := controller.Balances.RefundUnusedBalance(request.Context(), principal.UserId, body.AdAccountId, "NGN")
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusAccepted, map[string]any{"refunded": dtos.MoneyDto{AmountMinor: refunded, Currency: "NGN"}})
}

func (controller AdBalancesController) requireInternalToken(writer http.ResponseWriter, request *http.Request) bool {
	expected := controller.Container.Settings.InternalApiToken
	if len(expected) < 32 || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return false
	}
	return true
}

func (controller AdBalancesController) ApplySpendBatch(writer http.ResponseWriter, request *http.Request) {
	if !controller.requireInternalToken(writer, request) {
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.SpendBatchRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("batchId", body.BatchId, 1, 80)
		collector.RequireLength("accountId", body.AccountId, 1, 80)
		collector.RequireOneOf("currency", body.Currency, "NGN")
		collector.RequireRange("debitMinor", body.DebitMinor, 0, 10_000_000_000)
		if !adIdempotencyPattern.MatchString(body.IdempotencyKey) {
			collector.Add("idempotencyKey", "has an invalid format")
		}
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	result, err := controller.Balances.ApplySpendBatch(request.Context(), body)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller AdBalancesController) DebitWalletForBoost(writer http.ResponseWriter, request *http.Request) {
	controller.boost(writer, request, false)
}

func (controller AdBalancesController) RefundBoostRemainder(writer http.ResponseWriter, request *http.Request) {
	controller.boost(writer, request, true)
}

func (controller AdBalancesController) boost(writer http.ResponseWriter, request *http.Request, refund bool) {
	if !controller.requireInternalToken(writer, request) {
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.BoostDebitRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("userId", body.UserId, 1, 80)
		collector.RequireRange("amount.amountMinor", body.Amount.AmountMinor, 1, 10_000_000_000)
		collector.RequireOneOf("amount.currency", body.Amount.Currency, "NGN")
		if !adIdempotencyPattern.MatchString(body.IdempotencyKey) || (refund && !adIdempotencyPattern.MatchString(body.DebitIdempotencyKey)) {
			collector.Add("idempotencyKey", "has an invalid format")
		}
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	operation := controller.Balances.DebitForBoost
	if refund {
		operation = controller.Balances.RefundBoostRemainder
	}
	result, err := operation(request.Context(), body)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}
