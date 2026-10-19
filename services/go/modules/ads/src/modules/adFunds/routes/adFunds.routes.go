package routes

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/middlewares"
	"zudomart/modules/ads/src/modules/adFunds/controllers"
)

func MountAdFundsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.AdFundsController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	idempotent := middlewares.Idempotent(deployed)
	const balance = "/api/v1/ads/boosts/balance"
	mux.Handle("GET "+balance, authenticated(controller.GetBalance))
	mux.Handle("GET "+balance+"/transactions", authenticated(controller.ListTransactions))
	mux.Handle("POST "+balance+"/top-ups", idempotent(controller.StartTopUp))
	mux.Handle("POST "+balance+"/withdrawals/quote", authenticated(controller.QuoteWithdrawal))
	mux.Handle("POST "+balance+"/withdrawals", idempotent(controller.Withdraw))
	read := middlewares.Staff(deployed, "advertisers:manage", "ledger:read")
	manage := middlewares.StaffWithStepUp(deployed, "advertisers:manage")
	mux.Handle("GET /api/v1/admin/ads/credits", read(controller.ListCredits))
	mux.Handle("POST /api/v1/admin/ads/credits", manage(controller.IssueCredit))
	mux.Handle("POST /api/v1/admin/ads/credits/{creditId}/revoke", manage(controller.RevokeCredit))
	mux.Handle("GET /api/v1/admin/ads/cashback", read(controller.ListCashback))
	mux.Handle("PUT /api/v1/admin/ads/cashback/{userId}", manage(controller.SetCashback))
	mux.Handle("POST /internal/v1/ads/spend-batches/{batchId}/refunds", middlewares.Internal(deployed)(controller.RefundSpend))
}
