package routes

import (
	"net/http"

	"zudomart/modules/ledger/src/middlewares"
	"zudomart/modules/payments/src/modules/checkoutPayments/controllers"
	"zudomart/modules/payments/src/modules/gateway"
)

func MountCheckoutPaymentsRoutes(mux *http.ServeMux, application *gateway.Application) {
	controller := controllers.CheckoutPaymentsController{Application: application}
	requireUser := middlewares.RequireUserAccessToken(application.Container.Resources.AccessVerifier)
	mux.Handle("POST /api/v1/payments/initialize", requireUser(http.HandlerFunc(controller.InitializeOrderPayment)))
	mux.Handle("POST /api/v1/payments/orders/{orderId}/verify", requireUser(http.HandlerFunc(controller.VerifyOrderPayment)))
}
