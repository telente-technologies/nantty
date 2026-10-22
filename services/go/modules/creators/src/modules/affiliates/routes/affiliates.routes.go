package routes

import (
	"net/http"

	"zudomart/modules/creators/src/modules/affiliates/controllers"
	"zudomart/modules/ledger/src/middlewares"
	"zudomart/platform/httpserver"
)

func MountAffiliatesRoutes(mux *http.ServeMux, controller controllers.AffiliatesController) {
	requireUser := middlewares.RequireUserAccessToken(controller.Affiliates.Container.Resources.AccessVerifier)
	internalToken := httpserver.RequireInternalToken(controller.Affiliates.Container.Settings.InternalApiToken)
	user := func(handler http.HandlerFunc) http.Handler { return requireUser(handler) }
	mux.Handle("GET /api/v1/creators/affiliations", user(controller.MyAffiliations))
	mux.Handle("POST /api/v1/creators/affiliations", user(controller.RequestAffiliation))
	mux.Handle("DELETE /api/v1/creators/affiliations/{affiliationId}", user(controller.LeaveAffiliation))
	mux.Handle("GET /api/v1/creators/me/affiliated-products", user(controller.AffiliatedProducts))
	mux.Handle("GET /api/v1/creators/me/affiliate-catalog", user(controller.AffiliateCatalog))
	mux.Handle("GET /api/v1/creators/me/affiliate-promotions", user(controller.AffiliatePromotions))
	mux.Handle("GET /api/v1/creators/me/affiliate-earnings", user(controller.AffiliateEarnings))
	mux.Handle("POST /api/v1/creators/me/affiliate-links", user(controller.CreateAffiliateLink))
	mux.HandleFunc("POST /api/v1/affiliate-links/{linkId}/clicks", controller.RecordAffiliateLinkClick)
	mux.Handle("GET /api/v1/seller/affiliates/settings", user(controller.Settings))
	mux.Handle("PATCH /api/v1/seller/affiliates/settings", user(controller.UpdateSettings))
	mux.Handle("GET /api/v1/seller/affiliates/overview", user(controller.Overview))
	mux.Handle("GET /api/v1/seller/affiliates/product-commissions", user(controller.ProductCommissions))
	mux.Handle("PUT /api/v1/seller/affiliates/product-commissions/{productId}", user(controller.SetProductCommission))
	mux.Handle("GET /api/v1/seller/affiliates/requests", user(controller.Requests))
	mux.Handle("POST /api/v1/seller/affiliates/requests/{requestId}/{decision}", user(controller.DecideRequest))
	mux.Handle("GET /api/v1/seller/affiliates/creators", user(controller.Creators))
	mux.Handle("PATCH /api/v1/seller/affiliates/creators/{creatorId}", user(controller.SetCreatorStatus))
	mux.Handle("DELETE /api/v1/seller/affiliates/creators/{creatorId}", user(controller.SetCreatorStatus))
	mux.Handle("GET /api/v1/seller/affiliates/commission-ledger", user(controller.CommissionLedger))
	mux.Handle("GET /api/v1/internal/affiliates/commission-rates", internalToken(http.HandlerFunc(controller.CommissionRates)))
}
