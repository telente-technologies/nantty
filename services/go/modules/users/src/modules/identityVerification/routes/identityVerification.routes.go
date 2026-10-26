package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	decideverificationcase "nantty/modules/users/src/modules/identityVerification/commands/decideVerificationCase"
	"nantty/modules/users/src/modules/identityVerification/controllers"
	"nantty/platform/identityports"
	"nantty/platform/jwtauth"
	"nantty/platform/staffauth"
)

func MountIdentityVerificationRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.IdentityVerificationController{Container: container}
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	guard := staffauth.Guard{Registry: identityports.Default}
	user := func(handler http.HandlerFunc) http.Handler { return requireAccessToken(handler) }
	mux.Handle("GET /api/v1/verification/journey", user(controller.Journey))
	mux.Handle("POST /api/v1/verification/eligibility/request", user(controller.Request))
	mux.Handle("GET /api/v1/verification/document-types", user(controller.DocumentTypes))
	mux.Handle("POST /api/v1/verification/cases/{caseId}/capture", user(controller.StartCapture))
	mux.HandleFunc("POST /api/v1/webhooks/smile-id", controller.SmileCallback)

	mux.Handle("GET /api/v1/admin/verification-cases", guard.RequireStaff("verification:review", false)(http.HandlerFunc(controller.ListCases)))
	mux.Handle("GET /api/v1/admin/verification-cases/{caseId}", guard.RequireStaff("verification:review", false)(http.HandlerFunc(controller.GetCase)))
	mux.Handle("POST /api/v1/admin/verification-cases/{caseId}/approve", guard.RequireStaff("verification:review", true)(controller.DecisionHandler(decideverificationcase.ActionApprove)))
	mux.Handle("POST /api/v1/admin/verification-cases/{caseId}/reject", guard.RequireStaff("verification:review", true)(controller.DecisionHandler(decideverificationcase.ActionReject)))
}
