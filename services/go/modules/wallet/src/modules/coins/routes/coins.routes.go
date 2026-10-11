package routes

import (
	"net/http"

	"zudomart/modules/ledger/src/constants"
	"zudomart/modules/ledger/src/middlewares"
	"zudomart/modules/wallet/src/modules/coins"
	"zudomart/modules/wallet/src/modules/coins/controllers"
)

func MountCoinsRoutes(mux *http.ServeMux, application *coins.Application) {
	controller := controllers.CoinsController{Application: application}
	requireUser := middlewares.RequireUserAccessToken(application.Container.Resources.AccessVerifier)
	requirePricingRead := middlewares.RequireStaffWithAnyPermission(application.Container.Resources.StaffVerifiers, []string{constants.PermissionReadMonetization, constants.PermissionManageMonetization}, false)
	requirePricingWrite := middlewares.RequireStaffPermission(application.Container.Resources.StaffVerifiers, constants.PermissionManageMonetization, true)
	requireCoinReview := middlewares.RequireStaffPermission(application.Container.Resources.StaffVerifiers, constants.PermissionReviewCoins, false)
	requireCoinReversal := middlewares.RequireStaffPermissionWithSingleUseStepUp(application.Container.Resources.StaffVerifiers, constants.PermissionReviewCoins)
	mux.Handle("GET /api/v1/admin/coins/transactions", requireCoinReview(http.HandlerFunc(controller.ListCoinTransactionsForStaff)))
	mux.Handle("GET /api/v1/admin/coins/transactions/{transactionId}", requireCoinReview(http.HandlerFunc(controller.GetCoinTransactionForStaff)))
	mux.Handle("POST /api/v1/admin/coins/transactions/{transactionId}/mark-reviewed", requireCoinReview(http.HandlerFunc(controller.MarkCoinTransactionReviewed)))
	mux.Handle("POST /api/v1/admin/coins/transactions/{transactionId}/reverse", requireCoinReversal(http.HandlerFunc(controller.ReverseCoinTransaction)))
	mux.Handle("GET /api/v1/admin/coins/price-table", requirePricingRead(http.HandlerFunc(controller.ListCoinPriceTable)))
	mux.Handle("PUT /api/v1/admin/coins/price-table/{packageId}", requirePricingWrite(http.HandlerFunc(controller.UpsertCoinPriceRow)))
	mux.HandleFunc("GET /api/v1/coins/packages", controller.ListCoinPackages)
	mux.HandleFunc("GET /api/v1/coins/packs", controller.ListCoinPackages)
	mux.Handle("GET /api/v1/coins/balance", requireUser(http.HandlerFunc(controller.GetCoinBalance)))
	mux.Handle("GET /api/v1/coins/transactions", requireUser(http.HandlerFunc(controller.ListCoinActivity)))
	mux.Handle("POST /api/v1/coins/purchases", requireUser(http.HandlerFunc(controller.StartCoinPurchase)))
	mux.Handle("POST /api/v1/coins/purchases/{reference}/verify", requireUser(http.HandlerFunc(controller.VerifyCoinPurchase)))
	mux.Handle("POST /api/v1/coins/iap/receipts", requireUser(http.HandlerFunc(controller.RedeemStoreReceipt)))
	mux.Handle("GET /api/v1/coins/transfers/quote", requireUser(http.HandlerFunc(controller.QuoteCoinTransfer)))
	mux.Handle("POST /api/v1/coins/transfers", requireUser(http.HandlerFunc(controller.TransferCoins)))
	mux.Handle("POST /api/v1/creators/earnings/convert", requireUser(http.HandlerFunc(controller.ConvertEarnedCoins)))
}
