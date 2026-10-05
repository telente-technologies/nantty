package controllers

import (
	"net/http"
	"strings"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/connectedAccounts/dtos"
	"zudomart/modules/payments/src/modules/gateway"
	"zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/platform/httpserver"
)

type ConnectedAccountsController struct {
	Application *gateway.Application
}

func (controller ConnectedAccountsController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
}

func (controller ConnectedAccountsController) GetMyConnectedAccount(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	account, err := controller.Application.Gateway.FindConnectedAccountRowForUser(request.Context(), controller.Application.Container.Resources.Database, principal.UserId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, services.ConvertConnectedAccountToView(account))
}

func (controller ConnectedAccountsController) CreateMyConnectedAccount(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(dtos.CreateConnectedAccountRequestDto) error { return nil })
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	account, err := controller.Application.Gateway.EnsureConnectedAccountForUser(request.Context(), principal.UserId, body.AcceptPayments)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusAccepted, services.ConvertConnectedAccountToView(account))
}

func (controller ConnectedAccountsController) CreateMyOnboardingLink(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	link, err := controller.Application.Gateway.CreatePayoutVerificationLink(request.Context(), principal.UserId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, dtos.OnboardingLinkDto{Url: link.Url, ExpiresAt: link.ExpiresAt})
}

func (controller ConnectedAccountsController) StartWebSubscriptionCheckout(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.StartWebSubscriptionRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("planCode", body.PlanCode, 1, 60)
		collector.RequireLength("returnTo", body.ReturnTo, 0, 300)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if !controller.Application.Gateway.IsAllowedReturnUrl(body.ReturnTo) {
		controller.fail(writer, request, httpserver.NewApiError(http.StatusUnprocessableEntity, "RETURN_URL_NOT_ALLOWED", "This return address is not allowed."))
		return
	}
	platform := strings.ToLower(strings.TrimSpace(request.Header.Get("X-Client-Platform")))
	checkout, err := controller.Application.Gateway.StartWebSubscriptionCheckout(request.Context(), principal.UserId, body.PlanCode, body.ReturnTo, platform)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, checkout)
}

func (controller ConnectedAccountsController) SubmitDisputeEvidence(writer http.ResponseWriter, request *http.Request) {
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.DisputeEvidenceRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("productDescription", body.ProductDescription, 1, 500)
		collector.RequireLength("notes", body.Notes, 0, 2000)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	err = controller.Application.Gateway.SubmitProviderDisputeEvidence(request.Context(), request.PathValue("providerDisputeId"), interfaces.DisputeEvidence{
		CustomerName: body.CustomerName, CustomerEmail: body.CustomerEmail, ProductDescription: body.ProductDescription, Notes: body.Notes,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]bool{"submitted": true})
}
