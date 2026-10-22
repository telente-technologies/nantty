package routes

import (
	"net/http"

	"zudomart/modules/users/src/container"
	transitionblackapplication "zudomart/modules/users/src/modules/checkmarks/commands/transitionBlackApplication"
	"zudomart/modules/users/src/modules/checkmarks/controllers"
	"zudomart/platform/httpserver"
	"zudomart/platform/identityports"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

func MountCheckmarksRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.CheckmarksController{Container: container}
	internalToken := httpserver.RequireInternalToken(container.Settings.Privacy.InternalApiToken)
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	guard := staffauth.Guard{Registry: identityports.Default}
	review := guard.RequireStaffWithAnyPermission([]string{"verification:review", "verification:revoke"}, false)
	reviewStepUp := guard.RequireStaff("verification:review", true)
	revokeStepUp := guard.RequireStaff("verification:revoke", true)
	user := func(handler http.HandlerFunc) http.Handler { return requireAccessToken(handler) }
	mux.Handle("GET /api/v1/verification/suggestions", user(controller.Suggestions))
	mux.Handle("POST /api/v1/verification/suggestions/{color}/dismiss", user(controller.DismissSuggestion))
	mux.Handle("GET /api/v1/verification/me", user(controller.Me))
	mux.Handle("POST /api/v1/verification/applications", user(controller.Apply))
	mux.Handle("POST /api/v1/verification/black-applications", user(controller.ApplyBlack))

	mux.Handle("GET /api/v1/admin/verifications", review(http.HandlerFunc(controller.ListVerifications)))
	mux.Handle("GET /api/v1/admin/verifications/{verificationId}", review(http.HandlerFunc(controller.GetVerification)))
	mux.Handle("GET /api/v1/admin/verifications/{verificationId}/documents/{documentId}", guard.RequireStaff("verification:documents", false)(http.HandlerFunc(controller.OpenVerificationDocument)))
	mux.Handle("POST /api/v1/admin/verifications/{verificationId}/approve", reviewStepUp(controller.TransitionHandler("approve")))
	mux.Handle("POST /api/v1/admin/verifications/{verificationId}/reject", reviewStepUp(controller.TransitionHandler("reject")))
	mux.Handle("POST /api/v1/admin/verifications/{verificationId}/reinstate", reviewStepUp(controller.TransitionHandler("reinstate")))
	mux.Handle("POST /api/v1/admin/verifications/{verificationId}/suspend", revokeStepUp(controller.TransitionHandler("suspend")))
	mux.Handle("POST /api/v1/admin/verifications/{verificationId}/revoke", revokeStepUp(controller.TransitionHandler("revoke")))

	mux.Handle("GET /api/v1/admin/checkmark-grants", guard.RequireStaffWithAnyPermission([]string{"verification:grant", "verification:revoke"}, false)(http.HandlerFunc(controller.ListGrants)))
	mux.Handle("POST /api/v1/admin/checkmark-grants", guard.RequireStaff("verification:grant", true)(http.HandlerFunc(controller.Grant)))
	mux.Handle("POST /api/v1/admin/checkmark-grants/{grantId}/revoke", revokeStepUp(http.HandlerFunc(controller.RevokeGrant)))
	mux.Handle("GET /api/v1/admin/accounts/created", guard.RequireStaffWithAnyPermission([]string{"users:read", "verification:grant"}, false)(http.HandlerFunc(controller.ListCreatedAccounts)))
	mux.Handle("POST /api/v1/admin/accounts", guard.RequireStaff("verification:grant", true)(http.HandlerFunc(controller.CreateAccount)))

	mux.Handle("GET /api/v1/admin/black-applications", review(http.HandlerFunc(controller.ListBlack)))
	mux.Handle("POST /api/v1/admin/black-applications/{blackId}/checklist", guard.RequireStaff("verification:review", false)(controller.BlackTransitionHandler(transitionblackapplication.ActionChecklist)))
	mux.Handle("POST /api/v1/admin/black-applications/{blackId}/approve", reviewStepUp(controller.BlackTransitionHandler(transitionblackapplication.ActionApprove)))
	mux.Handle("POST /api/v1/admin/black-applications/{blackId}/reject", reviewStepUp(controller.BlackTransitionHandler(transitionblackapplication.ActionReject)))
	mux.Handle("POST /api/v1/admin/black-applications/{blackId}/revoke", revokeStepUp(controller.BlackTransitionHandler(transitionblackapplication.ActionRevoke)))
	mux.Handle("POST /api/v1/admin/black-applications/{blackId}/reverification-reminder", guard.RequireStaff("verification:review", false)(controller.BlackTransitionHandler(transitionblackapplication.ActionReminder)))
	mux.Handle("POST /api/v1/internal/checkmarks/{profileId}/billing-events", internalToken(http.HandlerFunc(controller.BillingEvent)))
}
