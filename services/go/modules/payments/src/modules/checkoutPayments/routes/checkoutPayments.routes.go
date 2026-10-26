package routes

import (
	"nantty/platform/httpserver"
	"net/http"

	"nantty/modules/ledger/src/middlewares"
	"nantty/modules/payments/src/modules/checkoutPayments/controllers"
	"nantty/modules/payments/src/modules/gateway"
)

func MountCheckoutPaymentsRoutes(mux *http.ServeMux, application *gateway.Application) {
	controller := controllers.CheckoutPaymentsController{Application: application}
	requireUser := middlewares.RequireUserAccessToken(application.Container.Resources.AccessVerifier)
	mux.Handle("POST /api/v1/payments/initialize", requireUser(http.HandlerFunc(controller.InitializeOrderPayment)))
	mux.HandleFunc("GET /api/v1/payments/channels", func(writer http.ResponseWriter, _ *http.Request) {
		httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"channels": application.Container.Settings.CheckoutChannels})
	})
	mux.Handle("POST /api/v1/payments/orders/{orderId}/verify", requireUser(http.HandlerFunc(controller.VerifyOrderPayment)))
	mux.Handle("GET /api/v1/payments/{reference}", requireUser(http.HandlerFunc(controller.GetPaymentStatus)))
}
