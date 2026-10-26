package controllers

import (
	"net/http"
	"regexp"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/paymentintent"
	"nantty/modules/payments/src/modules/gateway/services"
	"nantty/platform/httpserver"
)

var paymentReferencePattern = regexp.MustCompile(`^[A-Za-z0-9_.=-]{4,120}$`)

func (controller CheckoutPaymentsController) GetPaymentStatus(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	reference := request.PathValue("reference")
	if !paymentReferencePattern.MatchString(reference) {
		controller.respondWithError(writer, request, services.ErrPaymentNotFound)
		return
	}
	container := controller.Application.Container
	intent, err := container.Client(container.Resources.Database).PaymentIntent.Query().Where(paymentintent.Reference(reference), paymentintent.OwnerUserID(principal.UserId)).Only(request.Context())
	if ent.IsNotFound(err) {
		controller.respondWithError(writer, request, services.ErrPaymentNotFound)
		return
	}
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	view := services.ConvertPaymentIntentToView(intent)
	if intent.Status == paymentintent.StatusPending {
		if refreshed, refreshErr := controller.Application.Gateway.VerifyAndSettlePaymentIntentByReference(request.Context(), reference); refreshErr == nil {
			view = refreshed
		}
	}
	view.CheckoutUrl, view.AuthorizationUrl = nil, nil
	writer.Header().Set("Cache-Control", "no-store")
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}
