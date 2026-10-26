package controllers

import (
	"net/http"
	"strings"

	"github.com/google/uuid"

	ledgerutils "nantty/modules/ledger/src/utils"
	reviewwithdrawal "nantty/modules/wallet/src/modules/payouts/commands/reviewWithdrawal"
	getstaffwithdrawal "nantty/modules/wallet/src/modules/payouts/queries/getStaffWithdrawal"
	liststaffwithdrawals "nantty/modules/wallet/src/modules/payouts/queries/listStaffWithdrawals"
	"nantty/modules/wallet/src/modules/payouts/services"
	"nantty/modules/wallet/src/modules/payouts/validators"
	"nantty/platform/httpserver"
	"nantty/platform/staffaudit"
	"nantty/platform/staffauth"
)

func (controller WithdrawalsController) ListWithdrawalsForStaff(writer http.ResponseWriter, request *http.Request) {
	parameters := request.URL.Query()
	collector := &ledgerutils.IssueCollector{}
	query := liststaffwithdrawals.Query{Status: parameters.Get("status"), Search: strings.TrimSpace(parameters.Get("search")), Limit: ledgerutils.ReadPageLimit(request)}
	if query.Status != "" {
		collector.RequireOneOf("status", query.Status, withdrawalStatuses...)
	}
	collector.RequireLength("search", query.Search, 0, 120)
	if err := collector.Result(); err != nil {
		controller.fail(writer, request, err)
		return
	}
	cursor, err := validators.ReadCursor(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	query.AfterId = cursor
	page, err := liststaffwithdrawals.Handler{Application: controller.Application}.Execute(request.Context(), query)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (controller WithdrawalsController) GetWithdrawalForStaff(writer http.ResponseWriter, request *http.Request) {
	withdrawalId, err := uuid.Parse(request.PathValue("withdrawalId"))
	if err != nil {
		controller.fail(writer, request, services.ErrWithdrawalNotFound)
		return
	}
	detail, err := getstaffwithdrawal.Handler{Application: controller.Application}.Execute(request.Context(), getstaffwithdrawal.Query{WithdrawalId: withdrawalId})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, detail)
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
	reason := strings.TrimSpace(body.Reason)
	before, err := getstaffwithdrawal.Handler{Application: controller.Application}.Execute(request.Context(), getstaffwithdrawal.Query{WithdrawalId: withdrawalId})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	_, replayed, err := reviewwithdrawal.Handler{Application: controller.Application}.Execute(request.Context(), reviewwithdrawal.Command{
		StaffId: staff.Id, WithdrawalId: withdrawalId, Decision: body.Decision, Reason: reason, IdempotencyKey: key,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	detail, err := getstaffwithdrawal.Handler{Application: controller.Application}.Execute(request.Context(), getstaffwithdrawal.Query{WithdrawalId: withdrawalId})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if !replayed {
		controller.recordStaffAudit(request, staff, "withdrawal."+map[string]string{"approve": "approved", "reject": "rejected", "hold": "held"}[body.Decision], withdrawalId.String(), reason,
			map[string]any{"status": before.WithdrawalStatus}, map[string]any{"status": detail.WithdrawalStatus, "amount": detail.Amount})
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusOK, detail, replayed)
}

func (controller WithdrawalsController) recordStaffAudit(request *http.Request, staff staffauth.Staff, action, subjectId, reason string, before, after any) {
	audit := controller.Application.Container.Audit
	if audit == nil {
		return
	}
	if err := staffaudit.RecordStaffChange(request, audit, staff, action, "withdrawal", subjectId, reason, before, after); err != nil {
		controller.Application.Container.Resources.Logger.ErrorContext(request.Context(), "staff audit record failed after a committed withdrawal decision", "action", action, "withdrawalId", subjectId, "error", err)
	}
}
