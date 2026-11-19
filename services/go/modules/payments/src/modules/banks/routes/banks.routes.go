package routes

import (
	"net/http"

	"nantty/modules/ledger/src/middlewares"
	"nantty/modules/payments/src/modules/banks/controllers"
	"nantty/modules/payments/src/modules/gateway"
)

func MountBanksRoutes(mux *http.ServeMux, application *gateway.Application) {
	controller := controllers.BanksController{Application: application}
	requireUser := middlewares.RequireUserAccessToken(application.Container.Resources.AccessVerifier)
	mux.Handle("GET /api/v1/banks", requireUser(http.HandlerFunc(controller.ListBanks)))
	mux.Handle("GET /api/v1/banks/{bankCode}/branches", requireUser(http.HandlerFunc(controller.ListBankBranches)))
	mux.Handle("POST /api/v1/banks/resolve-account", requireUser(http.HandlerFunc(controller.ResolveBankAccount)))
}
