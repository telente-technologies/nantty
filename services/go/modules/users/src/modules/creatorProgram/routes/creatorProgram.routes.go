package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/creatorProgram/controllers"
	"nantty/modules/users/src/modules/creatorProgram/middlewares"
	"nantty/platform/httpserver"
	"nantty/platform/identityports"
	"nantty/platform/jwtauth"
	"nantty/platform/staffauth"
)

func MountCreatorProgramRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.CreatorProgramController{Container: container}
	internalToken := httpserver.RequireInternalToken(container.Settings.Privacy.InternalApiToken)
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	guard := staffauth.Guard{Registry: identityports.Default}
	review := guard.RequireStaff("applications:creators", false)
	reviewStepUp := guard.RequireStaff("applications:creators", true)
	mux.Handle("GET /api/v1/creators/eligibility", requireAccessToken(http.HandlerFunc(controller.Eligibility)))
	mux.Handle("GET /api/v1/creators/applications/me", requireAccessToken(http.HandlerFunc(controller.MyApplication)))
	mux.Handle("POST /api/v1/creators/applications", requireAccessToken(middlewares.RequireCreatorApplicationIdempotencyKey(http.HandlerFunc(controller.Submit))))
	mux.Handle("GET /api/v1/admin/applications/creators", review(http.HandlerFunc(controller.List)))
	mux.Handle("GET /api/v1/admin/applications/creators/{applicationId}", review(http.HandlerFunc(controller.Detail)))
	mux.Handle("POST /api/v1/admin/applications/creators/{applicationId}/approve", reviewStepUp(http.HandlerFunc(controller.Approve)))
	mux.Handle("POST /api/v1/admin/applications/creators/{applicationId}/reject", reviewStepUp(http.HandlerFunc(controller.Reject)))
	mux.Handle("PUT /api/v1/internal/profiles/{profileId}/signals", internalToken(http.HandlerFunc(controller.PutSignals)))
}
