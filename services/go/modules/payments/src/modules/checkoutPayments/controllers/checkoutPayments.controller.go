package controllers

import (
	"net/http"

	ledgerutils "nantty/modules/ledger/src/utils"
	initializeorderpayment "nantty/modules/payments/src/modules/checkoutPayments/commands/initializeOrderPayment"
	verifyorderpayment "nantty/modules/payments/src/modules/checkoutPayments/commands/verifyOrderPayment"
	"nantty/modules/payments/src/modules/checkoutPayments/validators"
	"nantty/modules/payments/src/modules/gateway"
	"nantty/platform/httpserver"
)

type CheckoutPaymentsController struct {
	Application *gateway.Application
}

func (controller CheckoutPaymentsController) respondWithError(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
}

func (controller CheckoutPaymentsController) InitializeOrderPayment(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	key, err := ledgerutils.ReadRequiredIdempotencyKey(request)
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, validators.ValidateInitializeOrderPaymentRequest)
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	result, replayed, err := initializeorderpayment.Handler{Application: controller.Application}.Execute(request.Context(), initializeorderpayment.Command{
		BuyerUserId: principal.UserId, OrderId: body.OrderId, CheckoutId: body.CheckoutId, Provider: "", ReturnTo: body.ReturnTo, IdempotencyKey: key,
	})
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	ledgerutils.WriteIdempotentJsonResponse(writer, http.StatusCreated, result, replayed)
}

func (controller CheckoutPaymentsController) VerifyOrderPayment(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	orderId := request.PathValue("orderId")
	if len(orderId) == 0 || len(orderId) > 80 {
		controller.respondWithError(writer, request, httpserver.ErrNotFound)
		return
	}
	result, err := verifyorderpayment.Handler{Application: controller.Application}.Execute(request.Context(), verifyorderpayment.Command{BuyerUserId: principal.UserId, OrderId: orderId})
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}
