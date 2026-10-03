package routes

import (
	"net/http"

	"zudomart/modules/payments/src/modules/gateway"
	"zudomart/modules/payments/src/modules/webhooks/controllers"
)

func MountWebhooksRoutes(mux *http.ServeMux, application *gateway.Application) {
	controller := controllers.WebhooksController{Application: application}
	mux.HandleFunc("POST /api/v1/payments/webhooks/{provider}", controller.ReceiveProviderWebhook)
	mux.HandleFunc("POST /api/v1/payments/store-notifications/{store}", controller.ReceiveStoreRefundNotification)
}
