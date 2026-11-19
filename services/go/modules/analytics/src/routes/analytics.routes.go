package routes

import (
	"net/http"

	"nantty/modules/analytics/src/controllers"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
	"nantty/platform/staffauth"
)

func MountRoutes(mux *http.ServeMux, controller controllers.AnalyticsController, verifier *jwtauth.AccessTokenVerifier, staffVerifier *jwtauth.AccessTokenVerifier, staffGuard staffauth.Guard, internalToken string) {
	requireUser := jwtauth.RequireVerifiedAccessToken(verifier)
	mux.Handle("POST /api/v1/analytics/events", requireUser(http.HandlerFunc(controller.IngestEvents)))
	mux.Handle("GET /api/v1/analytics/creator/summary", requireUser(http.HandlerFunc(controller.CreatorSummary)))
	mux.Handle("GET /api/v1/analytics/seller/summary", requireUser(http.HandlerFunc(controller.SellerSummary)))

	requireInternal := httpserver.RequireInternalToken(internalToken)
	mux.Handle("POST /api/v1/internal/analytics/events", requireInternal(http.HandlerFunc(controller.IngestInternalEvents)))

	if staffVerifier != nil {
		requireStaff := jwtauth.RequireVerifiedAccessToken(staffVerifier)
		requireMetrics := staffGuard.RequireStaff("metrics:read", false)
		mux.Handle("GET /api/v1/admin/analytics/overview", requireStaff(requireMetrics(http.HandlerFunc(controller.PlatformOverview))))
	}
}
