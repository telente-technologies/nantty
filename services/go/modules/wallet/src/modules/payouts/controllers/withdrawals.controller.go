package controllers

import (
	"net/http"
	"strings"

	"github.com/google/uuid"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/wallet/src/modules/payouts"
	cancelwithdrawal "zudomart/modules/wallet/src/modules/payouts/commands/cancelWithdrawal"
	requestwithdrawal "zudomart/modules/wallet/src/modules/payouts/commands/requestWithdrawal"
	reviewwithdrawal "zudomart/modules/wallet/src/modules/payouts/commands/reviewWithdrawal"
	runpayouts "zudomart/modules/wallet/src/modules/payouts/commands/runPayouts"
	listwithdrawals "zudomart/modules/wallet/src/modules/payouts/queries/listWithdrawals"
	quotewithdrawal "zudomart/modules/wallet/src/modules/payouts/queries/quoteWithdrawal"
	"zudomart/modules/wallet/src/modules/payouts/services"
	"zudomart/modules/wallet/src/modules/payouts/validators"
	"zudomart/platform/httpserver"
	"zudomart/platform/staffauth"
)

type WithdrawalsController struct {
	Application *payouts.Application
}

func (controller WithdrawalsController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
}

func (controller WithdrawalsController) QuoteWithdrawal(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	accountId, amount, currency, err := validators.ReadWithdrawalQuoteQuery(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	quote, err := quotewithdrawal.Handler{Application: controller.Application}.Execute(request.Context(), quotewithdrawal.Query{UserId: principal.UserId, PayoutAccountId: accountId, AmountMinor: amount, Currency: currency})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, quote)
}

func (controller WithdrawalsController) RequestWithdrawal(writer http.ResponseWriter, request *http.Request) {
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
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validators.ValidateWithdrawalRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	created, replayed, err := requestwithdrawal.Handler{Application: controller.Application}.Execute(request.Context(), requestwithdrawal.Command{
		UserId: principal.UserId, PayoutAccountId: uuid.MustParse(body.PayoutAccountId), AmountMinor: body.Amount.AmountMinor, Currency: body.Amount.Currency, IdempotencyKey: key,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusCreated, created, replayed)
}

func (controller WithdrawalsController) ListMyWithdrawals(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	controller.listWithdrawals(writer, request, principal.UserId)
}

func (controller WithdrawalsController) ListWithdrawalsForStaff(writer http.ResponseWriter, request *http.Request) {
	controller.listWithdrawals(writer, request, "")
}

func (controller WithdrawalsController) listWithdrawals(writer http.ResponseWriter, request *http.Request, userId string) {
	status := request.URL.Query().Get("status")
	if status != "" {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireOneOf("status", status, "pending_review", "queued", "processing", "paid", "failed", "cancelled")
		if err := collector.Result(); err != nil {
			controller.fail(writer, request, err)
			return
		}
	}
	cursor, err := validators.ReadCursor(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	page, err := listwithdrawals.Handler{Application: controller.Application}.Execute(request.Context(), listwithdrawals.Query{UserId: userId, Status: status, AfterId: cursor, Limit: ledgerutils.ReadPageLimit(request)})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (controller WithdrawalsController) CancelWithdrawal(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	withdrawalId, err := uuid.Parse(request.PathValue("withdrawalId"))
	if err != nil {
		controller.fail(writer, request, services.ErrWithdrawalNotFound)
		return
	}
	cancelled, err := cancelwithdrawal.Handler{Application: controller.Application}.Execute(request.Context(), cancelwithdrawal.Command{UserId: principal.UserId, WithdrawalId: withdrawalId})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, cancelled)
}

func (controller WithdrawalsController) ReviewWithdrawal(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	withdrawalId, err := uuid.Parse(request.PathValue("withdrawalId"))
	if err != nil {
		controller.fail(writer, request, services.ErrWithdrawalNotFound)
		return
	}
	key, err := ledgerutils.ReadRequiredIdempotencyKey(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validators.ValidateReviewWithdrawalRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	reviewed, replayed, err := reviewwithdrawal.Handler{Application: controller.Application}.Execute(request.Context(), reviewwithdrawal.Command{
		StaffId: staff.Id, WithdrawalId: withdrawalId, Approve: body.Decision == "approve", Reason: strings.TrimSpace(body.Reason), IdempotencyKey: key,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusOK, reviewed, replayed)
}

func (controller WithdrawalsController) RunPayouts(writer http.ResponseWriter, request *http.Request) {
	report := runpayouts.Handler{Application: controller.Application}.Execute(request.Context(), runpayouts.Command{Maximum: 500})
	httpserver.WriteJsonResponse(writer, http.StatusOK, report)
}
