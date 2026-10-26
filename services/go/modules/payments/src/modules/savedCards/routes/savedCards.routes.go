package routes

import (
	"net/http"

	"nantty/modules/ledger/src/middlewares"
	"nantty/modules/payments/src/modules/gateway"
	"nantty/modules/payments/src/modules/savedCards/controllers"
)

func MountSavedCardsRoutes(mux *http.ServeMux, application *gateway.Application) {
	controller := controllers.SavedCardsController{Application: application}
	requireUser := middlewares.RequireUserAccessToken(application.Container.Resources.AccessVerifier)
	mux.Handle("POST /api/v1/payments/saved-cards/setups", requireUser(http.HandlerFunc(controller.StartSavedCardSetup)))
	mux.Handle("POST /api/v1/payments/saved-cards/setups/{reference}/complete", requireUser(http.HandlerFunc(controller.CompleteSavedCardSetup)))
	mux.Handle("POST /api/v1/payments/saved-cards/charges", requireUser(http.HandlerFunc(controller.ChargeSavedCard)))
	mux.Handle("POST /api/v1/payments/refunds/{refundId}/bank-destination", middlewares.RequireUserAccessTokenAndSingleUseStepUp(application.Container.Resources.AccessVerifier, application.Container.Resources.StaffVerifiers.SingleUse)(http.HandlerFunc(controller.SubmitRefundBankDestination)))
}
