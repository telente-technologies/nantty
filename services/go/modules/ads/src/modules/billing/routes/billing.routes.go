package routes

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/middlewares"
	"zudomart/modules/ads/src/modules/billing/controllers"
)

func MountBillingRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.BillingController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	base := "/api/v1/ads/accounts/{accountId}/billing"
	mux.Handle("GET "+base, authenticated(controller.GetOverview))
	mux.Handle("GET "+base+"/transactions", authenticated(controller.ListTransactions))
	mux.Handle("PUT "+base+"/spend-limit", authenticated(controller.SetSpendLimit))
	mux.Handle("PUT "+base+"/funding-mode", authenticated(controller.SetFundingMode))
	mux.HandleFunc("GET /api/v1/ads/pricing", controller.GetRegionalPricing)
	mux.HandleFunc("POST /api/v1/ads/pricing/estimate", controller.EstimateCampaignCost)
	mux.Handle("POST /internal/v1/ads/accounts/{accountId}/funds", middlewares.Internal(deployed)(controller.CreditFunds))
}
