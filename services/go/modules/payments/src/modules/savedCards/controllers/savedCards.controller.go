package controllers

import (
	"net/http"

	"github.com/google/uuid"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/payments/src/modules/gateway"
	"zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/payments/src/modules/savedCards/validators"
	"zudomart/platform/httpserver"
)

type SavedCardsController struct {
	Application *gateway.Application
}

func (controller SavedCardsController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
}

func (controller SavedCardsController) StartSavedCardSetup(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validators.ValidateStartSavedCardSetupRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if !controller.Application.Gateway.IsAllowedReturnUrl(body.ReturnTo) {
		controller.fail(writer, request, httpserver.NewApiError(http.StatusUnprocessableEntity, "RETURN_URL_NOT_ALLOWED", "This return address is not allowed."))
		return
	}
	started, err := controller.Application.Gateway.StartSavedCardSetup(request.Context(), services.CardSetupRequest{UserId: principal.UserId, ReturnTo: body.ReturnTo})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, started)
}

func (controller SavedCardsController) CompleteSavedCardSetup(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	card, err := controller.Application.Gateway.CompleteSavedCardSetup(request.Context(), principal.UserId, request.PathValue("reference"))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	writer.Header().Set("Cache-Control", "no-store")
	httpserver.WriteJsonResponse(writer, http.StatusOK, card)
}

func (controller SavedCardsController) ChargeSavedCard(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validators.ValidateChargeSavedCardRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	result, err := controller.Application.Gateway.ChargePaymentIntentWithSavedCard(request.Context(), services.SavedCardChargeRequest{
		UserId: principal.UserId, PaymentIntentReference: body.PaymentReference, SavedCardId: body.SavedCardId,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusAccepted, result)
}

func (controller SavedCardsController) SubmitRefundBankDestination(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	refundId, err := uuid.Parse(request.PathValue("refundId"))
	if err != nil {
		controller.fail(writer, request, services.ErrRefundNotFound)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validators.ValidateRefundBankDestinationRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	result, err := controller.Application.Gateway.SubmitRefundBankDestination(request.Context(), services.RefundBankDestination{
		UserId: principal.UserId, RefundId: refundId, BankCode: body.BankCode, AccountNumber: body.AccountNumber,
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}
