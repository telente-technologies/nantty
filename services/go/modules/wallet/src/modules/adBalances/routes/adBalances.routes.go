package routes

import (
	"net/http"

	"nantty/modules/ledger/src/middlewares"
	"nantty/modules/wallet/src/modules/adBalances/controllers"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

func MountAdBalancesRoutes(mux *http.ServeMux, controller controllers.AdBalancesController) {
	requireUser := middlewares.RequireUserAccessToken(controller.Container.Resources.AccessVerifier)
	requireAdultUser := func(handler http.Handler) http.Handler {
		return requireUser(jwtauth.RequireAdultAccount()(handler))
	}
	internalToken := httpserver.RequireInternalToken(controller.Container.Settings.InternalApiToken)
	mux.Handle("POST /api/v1/ads/balance/top-ups", requireAdultUser(http.HandlerFunc(controller.StartTopUp)))
	mux.Handle("GET /api/v1/ads/balance", requireUser(http.HandlerFunc(controller.GetBalance)))
	mux.Handle("POST /api/v1/ads/balance/refund", requireAdultUser(http.HandlerFunc(controller.RefundUnusedBalance)))
	mux.Handle("POST /api/v1/internal/ads/spend-batches", internalToken(http.HandlerFunc(controller.ApplySpendBatch)))
	mux.Handle("POST /api/v1/internal/ads/accounts/{adAccountId}/top-ups", internalToken(http.HandlerFunc(controller.StartTopUpForAdAccount)))
	mux.Handle("GET /api/v1/internal/ads/accounts/{adAccountId}/top-ups/{reference}", internalToken(http.HandlerFunc(controller.GetTopUpForAdAccount)))
	mux.Handle("POST /api/v1/internal/ads/boost-debits", internalToken(http.HandlerFunc(controller.DebitWalletForBoost)))
	mux.Handle("POST /api/v1/internal/ads/boost-refunds", internalToken(http.HandlerFunc(controller.RefundBoostRemainder)))
	mux.Handle("POST /api/v1/internal/ads/accounts/{adAccountId}/earnings-fundings", internalToken(http.HandlerFunc(controller.FundFromEarnings)))
	mux.Handle("POST /api/v1/internal/ads/boost-earnings-debits", internalToken(http.HandlerFunc(controller.DebitEarningsForBoost)))
	mux.Handle("POST /api/v1/internal/ads/step-up-consumptions", internalToken(http.HandlerFunc(controller.ConsumeStepUp)))
	mux.Handle("POST /api/v1/internal/ads/accounts/{adAccountId}/withdrawals", internalToken(http.HandlerFunc(controller.WithdrawAdBalanceToWallet)))
}
