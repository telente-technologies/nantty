package controllers

import (
	"net/http"
	"regexp"

	"github.com/google/uuid"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/payments/src/modules/gateway/services"
	"nantty/platform/httpserver"
)

var (
	payoutBankCodePattern      = regexp.MustCompile(`^[0-9A-Za-z]{2,20}$`)
	payoutAccountNumberPattern = regexp.MustCompile(`^[0-9]{10}$`)
)

func (controller ConnectedAccountsController) AdminRetryPayoutAccountJob(writer http.ResponseWriter, request *http.Request) {
	controller.retryJob(writer, request, "")
}

func (controller ConnectedAccountsController) retryJob(writer http.ResponseWriter, request *http.Request, userId string) {
	jobId, err := uuid.Parse(request.PathValue("jobId"))
	if err != nil {
		controller.fail(writer, request, services.ErrConnectedAccountJobNotFound)
		return
	}
	job, err := controller.Application.Gateway.RetryConnectedAccountJob(request.Context(), userId, jobId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusAccepted, job)
}

func (controller ConnectedAccountsController) AdminListStuckPayoutAccounts(writer http.ResponseWriter, request *http.Request) {
	views, err := controller.Application.Gateway.ListStuckPayoutAccounts(request.Context(), ledgerutils.ReadPageLimit(request))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"data": views, "nextCursor": nil})
}

func (controller ConnectedAccountsController) AdminSendVerificationPrompt(writer http.ResponseWriter, request *http.Request) {
	userId := request.PathValue("userId")
	if len(userId) == 0 || len(userId) > 80 {
		controller.fail(writer, request, httpserver.ErrNotFound)
		return
	}
	if err := controller.Application.Gateway.SendVerificationPrompt(request.Context(), userId); err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusAccepted, map[string]bool{"sent": true})
}
