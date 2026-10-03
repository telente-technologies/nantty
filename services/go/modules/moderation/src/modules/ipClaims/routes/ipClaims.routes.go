package routes

import (
	"net/http"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/middlewares"
	"zudomart/modules/moderation/src/modules/ipClaims/controllers"
	"zudomart/platform/jwtauth"
)

func MountIpClaimsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.IpClaimsController{Container: container}
	staff := func(stepUp bool) func(http.Handler) http.Handler {
		return middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, []string{"ip-claims:review"}, stepUp)
	}
	internal := middlewares.RequireInternalToken(container.Settings.IntakeToken)
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	mux.Handle("POST /api/v1/internal/ip-claims", internal(http.HandlerFunc(controller.Intake)))
	mux.Handle("POST /api/v1/ip-claims/{claimId}/response", requireAccessToken(http.HandlerFunc(controller.Respond)))
	mux.Handle("GET /api/v1/admin/ip-claims", staff(false)(http.HandlerFunc(controller.List)))
	mux.Handle("GET /api/v1/admin/ip-claims/{claimId}", staff(false)(http.HandlerFunc(controller.Detail)))
	mux.Handle("POST /api/v1/admin/ip-claims/{claimId}/uphold", staff(true)(controller.Decide("uphold")))
	mux.Handle("POST /api/v1/admin/ip-claims/{claimId}/reject", staff(false)(controller.Decide("reject")))
	mux.Handle("POST /api/v1/admin/ip-claims/{claimId}/request-info", staff(false)(controller.Decide("request_info")))
}
