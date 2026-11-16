package messengerauth

import (
	"net/http"

	"nantty/modules/auth/src/container"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

func Mount(mux *http.ServeMux, app *container.Container) {
	controller := Controller{Container: app}
	rateLimit := httpserver.RateLimitAuthEndpoints()
	requireSession := jwtauth.RequireVerifiedAccessToken(app.AccessVerifier)
	base := "/api/v1/auth/messenger/authorizations"
	mux.Handle("POST "+base, rateLimit(http.HandlerFunc(controller.Create)))
	mux.Handle("GET "+base, rateLimit(requireSession(http.HandlerFunc(controller.ListPendingAuthorizations))))
	mux.Handle("GET "+base+"/{authorizationId}", rateLimit(http.HandlerFunc(controller.Status)))
	mux.Handle("POST "+base+"/{authorizationId}/complete", rateLimit(http.HandlerFunc(controller.Complete)))
	mux.Handle("POST "+base+"/{authorizationId}/verify-code", rateLimit(http.HandlerFunc(controller.VerifyCode)))
	mux.Handle("POST "+base+"/{authorizationId}/approve", rateLimit(requireSession(http.HandlerFunc(controller.Approve))))
	mux.Handle("POST "+base+"/{authorizationId}/deny", rateLimit(requireSession(http.HandlerFunc(controller.Deny))))
	mux.Handle("POST "+base+"/{authorizationId}/code", rateLimit(requireSession(http.HandlerFunc(controller.IssueCode))))
	mux.Handle("POST "+base+"/{authorizationId}/recovery/email", rateLimit(http.HandlerFunc(controller.SendRecoveryEmail)))
	mux.Handle("POST "+base+"/{authorizationId}/recovery/verify", rateLimit(http.HandlerFunc(controller.VerifyRecoveryEmail)))
	mux.Handle("GET /api/v1/auth/messenger/devices", rateLimit(requireSession(http.HandlerFunc(controller.ListDevices))))
	mux.Handle("DELETE /api/v1/auth/messenger/devices/{deviceId}", rateLimit(requireSession(http.HandlerFunc(controller.RevokeDevice))))
}
