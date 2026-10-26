package routes

import (
	"net/http"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/middlewares"
	"nantty/modules/moderation/src/modules/copyrightClaims/controllers"
	"nantty/platform/jwtauth"
)

func MountCopyrightClaimsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.CopyrightClaimsController{Container: container}
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	staff := middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, []string{"copyright:review"}, false)
	internal := middlewares.RequireInternalToken(container.Settings.IntakeToken)
	decider := middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, []string{"copyright:review"}, true)
	mux.Handle("GET /api/v1/admin/copyright-policy", staff(http.HandlerFunc(controller.GetPolicy)))
	mux.Handle("POST /api/v1/admin/copyright-claims/{claimId}/audio-match", staff(http.HandlerFunc(controller.RunAudioMatch)))
	mux.Handle("PUT /api/v1/admin/copyright-policy", decider(http.HandlerFunc(controller.UpdatePolicy)))
	mux.Handle("POST /api/v1/copyright/claims", requireAccessToken(http.HandlerFunc(controller.Submit)))
	mux.Handle("POST /api/v1/copyright/claims/{claimId}/counter-notices", requireAccessToken(http.HandlerFunc(controller.SubmitCounterNotice)))
	mux.Handle("GET /api/v1/admin/copyright-claims", staff(http.HandlerFunc(controller.List)))
	mux.Handle("GET /api/v1/admin/copyright-claims/{claimId}", staff(http.HandlerFunc(controller.Detail)))
	mux.Handle("POST /api/v1/admin/copyright-claims/{claimId}/uphold", decider(controller.Decide("uphold")))
	mux.Handle("POST /api/v1/admin/copyright-claims/{claimId}/reject", staff(controller.Decide("reject")))
	mux.Handle("POST /api/v1/admin/copyright-claims/{claimId}/request-info", staff(controller.Decide("request_info")))
	mux.Handle("POST /api/v1/admin/copyright-claims/{claimId}/counter-notices/{noticeId}/accept", decider(controller.DecideCounterNotice("accept")))
	mux.Handle("POST /api/v1/admin/copyright-claims/{claimId}/counter-notices/{noticeId}/reject", decider(controller.DecideCounterNotice("reject")))
	mux.Handle("POST /api/v1/admin/copyright-claims/{claimId}/counter-notices/{noticeId}/court-action", decider(controller.DecideCounterNotice("court_action")))
	mux.Handle("PUT /api/v1/internal/copyright-claims/{claimId}/audio-matches", internal(http.HandlerFunc(controller.RecordAudioMatches)))
}
