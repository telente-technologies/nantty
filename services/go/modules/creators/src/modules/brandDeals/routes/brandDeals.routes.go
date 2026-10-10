package routes

import (
	"net/http"

	"zudomart/modules/creators/src/modules/brandDeals/controllers"
	"zudomart/modules/ledger/src/middlewares"
)

func MountBrandDealsRoutes(mux *http.ServeMux, controller controllers.BrandDealsController) {
	requireUser := middlewares.RequireUserAccessToken(controller.Deals.Container.Resources.AccessVerifier)
	mux.Handle("GET /api/v1/creators/brand-deals", requireUser(http.HandlerFunc(controller.List)))
	mux.Handle("POST /api/v1/creators/brand-deals", requireUser(http.HandlerFunc(controller.Record)))
	mux.Handle("DELETE /api/v1/creators/brand-deals/{dealId}", requireUser(http.HandlerFunc(controller.Remove)))
}
