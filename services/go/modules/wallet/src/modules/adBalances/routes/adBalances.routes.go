package routes

import (
	"net/http"

	"zudomart/modules/ledger/src/middlewares"
	"zudomart/modules/wallet/src/modules/adBalances/controllers"
)

func MountAdBalancesRoutes(mux *http.ServeMux, controller controllers.AdBalancesController) {
	requireUser := middlewares.RequireUserAccessToken(controller.Container.Resources.AccessVerifier)
	mux.Handle("POST /api/v1/ads/balance/top-ups", requireUser(http.HandlerFunc(controller.StartTopUp)))
	mux.Handle("GET /api/v1/ads/balance", requireUser(http.HandlerFunc(controller.GetBalance)))
	mux.Handle("POST /api/v1/ads/balance/refund", requireUser(http.HandlerFunc(controller.RefundUnusedBalance)))
	mux.HandleFunc("POST /api/v1/internal/ads/spend-batches", controller.ApplySpendBatch)
	mux.HandleFunc("POST /api/v1/internal/ads/boost-debits", controller.DebitWalletForBoost)
	mux.HandleFunc("POST /api/v1/internal/ads/boost-refunds", controller.RefundBoostRemainder)
}
