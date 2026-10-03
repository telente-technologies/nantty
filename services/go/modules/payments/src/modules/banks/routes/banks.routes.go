package routes

import (
	"net/http"

	"zudomart/modules/ledger/src/middlewares"
	"zudomart/modules/payments/src/modules/banks/controllers"
	"zudomart/modules/payments/src/modules/gateway"
)

func MountBanksRoutes(mux *http.ServeMux, application *gateway.Application) {
	controller := controllers.BanksController{Application: application}
	requireUser := middlewares.RequireUserAccessToken(application.Container.Resources.AccessVerifier)
	mux.Handle("GET /api/v1/banks", requireUser(http.HandlerFunc(controller.ListBanks)))
	mux.Handle("POST /api/v1/banks/resolve-account", requireUser(http.HandlerFunc(controller.ResolveBankAccount)))
}
