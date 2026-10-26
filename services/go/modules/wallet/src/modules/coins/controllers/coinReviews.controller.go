package controllers

import (
	"net/http"
	"strings"

	"github.com/google/uuid"

	ledgerutils "nantty/modules/ledger/src/utils"
	markcointransactionreviewed "nantty/modules/wallet/src/modules/coins/commands/markCoinTransactionReviewed"
	reversecointransaction "nantty/modules/wallet/src/modules/coins/commands/reverseCoinTransaction"
	"nantty/modules/wallet/src/modules/coins/dtos"
	getstaffcointransaction "nantty/modules/wallet/src/modules/coins/queries/getStaffCoinTransaction"
	liststaffcointransactions "nantty/modules/wallet/src/modules/coins/queries/listStaffCoinTransactions"
	"nantty/modules/wallet/src/modules/coins/services"
	"nantty/platform/httpserver"
	"nantty/platform/staffaudit"
	"nantty/platform/staffauth"
)

func (controller CoinsController) ListCoinTransactionsForStaff(writer http.ResponseWriter, request *http.Request) {
	parameters := request.URL.Query()
	collector := &ledgerutils.IssueCollector{}
	query := liststaffcointransactions.Query{Kind: parameters.Get("kind"), ReviewStatus: parameters.Get("status"), Search: strings.TrimSpace(parameters.Get("search")), Limit: ledgerutils.ReadPageLimit(request)}
	if query.Kind != "" {
		collector.RequireOneOf("kind", query.Kind, "purchase", "transfer")
	}
	if query.ReviewStatus != "" {
		collector.RequireOneOf("status", query.ReviewStatus, "not_required", "pending_review", "reviewed", "reversed")
	}
	collector.RequireLength("search", query.Search, 0, 200)
	if cursor := parameters.Get("cursor"); cursor != "" {
		parsed, err := uuid.Parse(cursor)
		if err != nil {
			collector.Add("cursor", "is invalid")
		}
		query.AfterId = &parsed
	}
	if err := collector.Result(); err != nil {
		controller.fail(writer, request, err)
		return
	}
	page, err := liststaffcointransactions.Handler{Application: controller.Application}.Execute(request.Context(), query)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (controller CoinsController) GetCoinTransactionForStaff(writer http.ResponseWriter, request *http.Request) {
	transactionId, err := uuid.Parse(request.PathValue("transactionId"))
	if err != nil {
		controller.fail(writer, request, services.ErrCoinTransactionNotFound)
		return
	}
	detail, err := getstaffcointransaction.Handler{Application: controller.Application}.Execute(request.Context(), getstaffcointransaction.Query{TransactionId: transactionId})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, detail)
}

func (controller CoinsController) MarkCoinTransactionReviewed(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	transactionId, err := uuid.Parse(request.PathValue("transactionId"))
	if err != nil {
		controller.fail(writer, request, services.ErrCoinTransactionNotFound)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validateCoinReviewReason(0))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	reason := strings.TrimSpace(body.Reason)
	if err := (markcointransactionreviewed.Handler{Application: controller.Application}).Execute(request.Context(), markcointransactionreviewed.Command{StaffId: staff.Id, TransactionId: transactionId, Note: reason}); err != nil {
		controller.fail(writer, request, err)
		return
	}
	controller.respondWithStaffCoinTransaction(writer, request, staff, "coins.reviewed", transactionId, reason, false)
}

func (controller CoinsController) ReverseCoinTransaction(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	transactionId, err := uuid.Parse(request.PathValue("transactionId"))
	if err != nil {
		controller.fail(writer, request, services.ErrCoinTransactionNotFound)
		return
	}
	key, err := ledgerutils.ReadRequiredIdempotencyKey(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validateCoinReviewReason(3))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	reason := strings.TrimSpace(body.Reason)
	replayed, err := reversecointransaction.Handler{Application: controller.Application}.Execute(request.Context(), reversecointransaction.Command{
		StaffId: staff.Id, TransactionId: transactionId, Reason: reason, IdempotencyKey: key,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	controller.respondWithStaffCoinTransaction(writer, request, staff, "coins.reversed", transactionId, reason, replayed)
}

func (controller CoinsController) respondWithStaffCoinTransaction(writer http.ResponseWriter, request *http.Request, staff staffauth.Staff, action string, transactionId uuid.UUID, reason string, replayed bool) {
	detail, err := getstaffcointransaction.Handler{Application: controller.Application}.Execute(request.Context(), getstaffcointransaction.Query{TransactionId: transactionId})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if audit := controller.Application.Container.Audit; audit != nil && !replayed {
		after := map[string]any{"reviewStatus": detail.ReviewStatus, "transactionStatus": detail.TransactionStatus, "coins": detail.Coins}
		if err := staffaudit.RecordStaffChange(request, audit, staff, action, "coin_transaction", transactionId.String(), reason, nil, after); err != nil {
			controller.Application.Container.Resources.Logger.ErrorContext(request.Context(), "staff audit record failed after a committed coin review", "action", action, "transactionId", transactionId.String(), "error", err)
		}
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusOK, detail, replayed)
}

func validateCoinReviewReason(minimum int) func(dtos.CoinReviewRequestDto) error {
	return func(body dtos.CoinReviewRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("reason", strings.TrimSpace(body.Reason), minimum, 1000)
		return collector.Result()
	}
}
