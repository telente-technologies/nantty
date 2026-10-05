package routes

import (
	"net/http"

	"zudomart/modules/creators/src/modules/creatorMoney/controllers"
	"zudomart/modules/ledger/src/middlewares"
)

func MountCreatorMoneyRoutes(mux *http.ServeMux, controller controllers.CreatorMoneyController) {
	requireUser := middlewares.RequireUserAccessToken(controller.Money.Container.Resources.AccessVerifier)
	user := func(handler http.HandlerFunc) http.Handler { return requireUser(handler) }
	mux.Handle("GET /api/v1/creators/me", user(controller.MyStatus))
	mux.Handle("GET /api/v1/creators/revenue-rules", user(controller.RevenueRules))
	mux.Handle("GET /api/v1/creators/earnings", user(controller.Earnings))
	mux.Handle("GET /api/v1/creators/dashboard", user(controller.Dashboard))
	mux.Handle("POST /api/v1/tips", user(controller.SendTip))
}
