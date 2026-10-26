package controllers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/payments/src/modules/gateway/services"
	"nantty/platform/httpserver"
	"nantty/platform/staffaudit"
	"nantty/platform/staffauth"
)

type staffReasonRequest struct {
	Reason string `json:"reason"`
}

func validateStaffReason(body staffReasonRequest) error {
	collector := &ledgerutils.IssueCollector{}
	collector.RequireLength("reason", strings.TrimSpace(body.Reason), 5, 500)
	return collector.Result()
}

func (controller ProviderWalletsController) audit(request *http.Request, action, subjectType, subjectId, reason string, before, after any) {
	recorder := controller.Application.Container.Audit
	staff, _ := staffauth.StaffFromContext(request.Context())
	if recorder == nil {
		controller.Application.Container.Resources.Logger.WarnContext(request.Context(), "staff audit is not configured; payments staff action logged only", "action", action, "subjectId", subjectId, "staffId", staff.Id)
		return
	}
	if err := staffaudit.RecordStaffChange(request, recorder, staff, action, subjectType, subjectId, reason, before, after); err != nil {
		controller.Application.Container.Resources.Logger.ErrorContext(request.Context(), "staff audit record failed after a committed payments action", "action", action, "subjectId", subjectId, "error", err)
	}
}

func (controller ProviderWalletsController) ListDeadLetters(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	provider := query.Get("provider")
	if provider != "" && provider != "flutterwave" {
		controller.fail(writer, request, httpserver.NewApiError(http.StatusBadRequest, "INVALID_PROVIDER", "provider must be flutterwave."))
		return
	}
	limit, _ := strconv.Atoi(query.Get("limit"))
	if limit == 0 {
		limit = 50
	}
	rows, err := controller.Application.Gateway.ListDeadLetteredWebhooks(request.Context(), provider, limit)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"items": rows})
}

func (controller ProviderWalletsController) GetDeadLetter(writer http.ResponseWriter, request *http.Request) {
	id, err := uuid.Parse(request.PathValue("webhookId"))
	if err != nil {
		controller.fail(writer, request, services.ErrDeadLetterNotFound)
		return
	}
	view, err := controller.Application.Gateway.GetDeadLetteredWebhook(request.Context(), id)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	writer.Header().Set("Cache-Control", "no-store")
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller ProviderWalletsController) ReplayDeadLetter(writer http.ResponseWriter, request *http.Request) {
	id, err := uuid.Parse(request.PathValue("webhookId"))
	if err != nil {
		controller.fail(writer, request, services.ErrDeadLetterNotFound)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validateStaffReason)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	before, err := controller.Application.Gateway.GetDeadLetteredWebhook(request.Context(), id)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	after, err := controller.Application.Gateway.ReplayDeadLetteredWebhook(request.Context(), id)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	controller.audit(request, "paymentWebhook.replayed", "paymentWebhook", id.String(), body.Reason,
		map[string]any{"attempts": before.Attempts, "deadLetteredAt": before.DeadLetteredAt}, map[string]any{"processedAt": after.ProcessedAt, "attempts": after.Attempts})
	httpserver.WriteJsonResponse(writer, http.StatusOK, after)
}

func (controller ProviderWalletsController) RejectFunding(writer http.ResponseWriter, request *http.Request) {
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validateStaffReason)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	reference := request.PathValue("reference")
	if err := controller.Application.Gateway.RejectWalletFunding(request.Context(), reference, body.Reason); err != nil {
		controller.fail(writer, request, err)
		return
	}
	controller.audit(request, "walletFunding.rejected", "walletFunding", reference, body.Reason, map[string]any{"status": "held"}, map[string]any{"status": "reversed"})
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"reference": reference, "status": "reversed"})
}

func (controller ProviderWalletsController) UnfreezeWallet(writer http.ResponseWriter, request *http.Request) {
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validateStaffReason)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	userId := request.PathValue("userId")
	if !ledgerutils.IsUuid(userId) {
		controller.fail(writer, request, services.ErrProviderWalletMissing)
		return
	}
	if err := controller.Application.Gateway.UnfreezeProviderWallet(request.Context(), userId); err != nil {
		controller.fail(writer, request, err)
		return
	}
	controller.audit(request, "providerWallet.unfrozen", "providerWallet", userId, body.Reason, map[string]any{"status": "frozen"}, map[string]any{"status": "active"})
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"userId": userId, "status": "active"})
}

func (controller ProviderWalletsController) RunReconciliation(writer http.ResponseWriter, request *http.Request) {
	report, err := controller.Application.Gateway.RunDailyWalletReconciliation(request.Context())
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	controller.audit(request, "walletReconciliation.run", "reconciliationRun", report.RunId, "manual run", nil, report)
	httpserver.WriteJsonResponse(writer, http.StatusOK, report)
}
