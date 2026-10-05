package routes

import (
	"net/http"

	"zudomart/modules/ledger/src/constants"
	"zudomart/modules/ledger/src/middlewares"
	"zudomart/modules/wallet/src/modules/payouts"
	"zudomart/modules/wallet/src/modules/payouts/controllers"
)

func MountPayoutsRoutes(mux *http.ServeMux, application *payouts.Application) {
	wallet := controllers.WalletController{Application: application}
	withdrawals := controllers.WithdrawalsController{Application: application}
	resources := application.Container.Resources
	requireUser := middlewares.RequireUserAccessToken(resources.AccessVerifier)
	requireStaffRead := middlewares.RequireStaffPermission(resources.StaffVerifiers, constants.PermissionReadWithdrawals, false)
	requireStaffProcess := middlewares.RequireStaffPermission(resources.StaffVerifiers, constants.PermissionProcessWithdrawals, true)
	mux.HandleFunc("GET /api/v1/internal/accounts/{accountId}/deletion-blockers", controllers.InternalAccountsController{Application: application}.DeletionBlockers)
	mux.Handle("GET /api/v1/wallets/me", requireUser(http.HandlerFunc(wallet.GetWalletSummary)))
	mux.Handle("GET /api/v1/wallets/me/transactions", requireUser(http.HandlerFunc(wallet.ListWalletTransactions)))
	mux.Handle("GET /api/v1/wallets/me/payout-accounts", requireUser(http.HandlerFunc(wallet.ListPayoutAccounts)))
	mux.Handle("POST /api/v1/wallets/me/payout-accounts", requireUser(http.HandlerFunc(wallet.AddPayoutAccount)))
	mux.Handle("DELETE /api/v1/wallets/me/payout-accounts/{payoutAccountId}", requireUser(http.HandlerFunc(wallet.RemovePayoutAccount)))
	mux.Handle("GET /api/v1/wallets/me/withdrawals/quote", requireUser(http.HandlerFunc(withdrawals.QuoteWithdrawal)))
	mux.Handle("GET /api/v1/wallets/me/withdrawals", requireUser(http.HandlerFunc(withdrawals.ListMyWithdrawals)))
	mux.Handle("POST /api/v1/wallets/me/withdrawals", requireUser(http.HandlerFunc(withdrawals.RequestWithdrawal)))
	mux.Handle("POST /api/v1/wallets/me/withdrawals/{withdrawalId}/cancel", requireUser(http.HandlerFunc(withdrawals.CancelWithdrawal)))
	mux.Handle("GET /api/v1/admin/withdrawals", requireStaffRead(http.HandlerFunc(withdrawals.ListWithdrawalsForStaff)))
	mux.Handle("GET /api/v1/admin/withdrawals/{withdrawalId}", requireStaffRead(http.HandlerFunc(withdrawals.GetWithdrawalForStaff)))
	mux.Handle("POST /api/v1/admin/withdrawals/{withdrawalId}/review", requireStaffProcess(http.HandlerFunc(withdrawals.ReviewWithdrawal)))
	mux.Handle("POST /api/v1/admin/payouts/run", requireStaffProcess(http.HandlerFunc(withdrawals.RunPayouts)))
}

func MountSellerReserveRoutes(mux *http.ServeMux, controller controllers.SellerReservesController) {
	resources := controller.Application.Container.Resources
	requireRead := middlewares.RequireStaffPermission(resources.StaffVerifiers, constants.PermissionReadWithdrawals, false)
	requireWrite := middlewares.RequireStaffPermission(resources.StaffVerifiers, constants.PermissionProcessWithdrawals, true)
	mux.Handle("GET /api/v1/admin/wallet/seller-reserves", requireRead(http.HandlerFunc(controller.List)))
	mux.Handle("PUT /api/v1/admin/wallet/seller-reserves/{sellerUserId}", requireWrite(http.HandlerFunc(controller.Flag)))
	mux.Handle("DELETE /api/v1/admin/wallet/seller-reserves/{sellerUserId}", requireWrite(http.HandlerFunc(controller.Release)))
}
