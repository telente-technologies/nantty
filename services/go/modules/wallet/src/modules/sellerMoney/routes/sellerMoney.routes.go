package routes

import (
	"net/http"

	sellermoney "zudomart/modules/wallet/src/modules/sellerMoney"
	"zudomart/modules/wallet/src/modules/sellerMoney/controllers"
)

func MountSellerMoneyRoutes(mux *http.ServeMux, application *sellermoney.Application) {
	controller := controllers.SellerMoneyController{Application: application}
	internal := controller.Internal
	mux.Handle("GET /api/v1/internal/sellers/{sellerId}/wallet/balances", internal(controller.Balances))
	mux.Handle("GET /api/v1/internal/sellers/{sellerId}/wallet/transactions", internal(controller.Transactions))
	mux.Handle("GET /api/v1/internal/sellers/{sellerId}/wallet/statements", internal(controller.StatementCsv))
	mux.Handle("GET /api/v1/internal/sellers/{sellerId}/wallet/payout-settings", internal(controller.PayoutSettings))
	mux.Handle("GET /api/v1/internal/sellers/{sellerId}/wallet/payouts", internal(controller.Payouts))
	mux.Handle("POST /api/v1/internal/sellers/{sellerId}/wallet/payouts", internal(controller.RequestPayout))
	mux.Handle("GET /api/v1/internal/sellers/{sellerId}/wallet/payouts/schedule", internal(controller.PayoutSchedule))
	mux.Handle("PUT /api/v1/internal/sellers/{sellerId}/wallet/payouts/schedule", internal(controller.SavePayoutSchedule))
	mux.Handle("GET /api/v1/internal/sellers/{sellerId}/wallet/banks", internal(controller.Banks))
	mux.Handle("GET /api/v1/internal/sellers/{sellerId}/wallet/payout-accounts", internal(controller.PayoutAccounts))
	mux.Handle("POST /api/v1/internal/sellers/{sellerId}/wallet/payout-accounts/resolve", internal(controller.ResolvePayoutAccount))
	mux.Handle("POST /api/v1/internal/sellers/{sellerId}/wallet/payout-accounts", internal(controller.AddPayoutAccount))
	mux.Handle("PATCH /api/v1/internal/sellers/{sellerId}/wallet/payout-accounts/{accountId}", internal(controller.UpdatePayoutAccount))
	mux.Handle("DELETE /api/v1/internal/sellers/{sellerId}/wallet/payout-accounts/{accountId}", internal(controller.RemovePayoutAccount))
	mux.Handle("GET /api/v1/internal/sellers/{sellerId}/finance/summary", internal(controller.FinanceSummary))
	mux.Handle("GET /api/v1/internal/sellers/{sellerId}/finance/escrow", internal(controller.Escrow))
	mux.Handle("GET /api/v1/internal/sellers/{sellerId}/finance/settlements", internal(controller.Settlements))
	mux.Handle("GET /api/v1/internal/sellers/{sellerId}/finance/settlements/{settlementId}", internal(controller.Settlement))
	mux.Handle("GET /api/v1/internal/sellers/{sellerId}/finance/fees", internal(controller.Fees))
	mux.Handle("GET /api/v1/internal/sellers/{sellerId}/finance/refunds", internal(controller.Refunds))
	mux.Handle("GET /api/v1/internal/sellers/{sellerId}/finance/statements", internal(controller.Statements))
	mux.Handle("GET /api/v1/internal/sellers/{sellerId}/finance/statements/{month}", internal(controller.Statement))
}
