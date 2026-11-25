package developerapplications

import (
	"net/http"

	"nantty/modules/auth/src/container"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

func Mount(mux *http.ServeMux, app *container.Container) {
	controller := Controller{Container: app}
	requireAccess := jwtauth.RequireVerifiedAccessToken(app.AccessVerifier)
	rateLimit := httpserver.RateLimitEveryRequest(false)
	base := "/api/v1/developer/organizations/{organizationID}/applications"
	mux.Handle("GET "+base, rateLimit(requireAccess(http.HandlerFunc(controller.List))))
	mux.Handle("POST "+base, rateLimit(requireAccess(http.HandlerFunc(controller.Create))))
	mux.Handle("GET "+base+"/{applicationID}", rateLimit(requireAccess(http.HandlerFunc(controller.Get))))
	mux.Handle("GET "+base+"/{applicationID}/capabilities/me", rateLimit(requireAccess(http.HandlerFunc(controller.GetMyCapabilities))))
	mux.Handle("PATCH "+base+"/{applicationID}", rateLimit(requireAccess(http.HandlerFunc(controller.Update))))
	mux.Handle("DELETE "+base+"/{applicationID}", rateLimit(requireAccess(http.HandlerFunc(controller.Archive))))
	mux.Handle("GET "+base+"/{applicationID}/members", rateLimit(requireAccess(http.HandlerFunc(controller.ListMemberGrants))))
	mux.Handle("PUT "+base+"/{applicationID}/members/{membershipID}/grants", rateLimit(requireAccess(http.HandlerFunc(controller.ReplaceMemberGrants))))
	consents := "/api/v1/account/business-messaging/consents"
	mux.Handle("GET "+consents, rateLimit(requireAccess(http.HandlerFunc(controller.ListBusinessConsents))))
	mux.Handle("POST "+consents, rateLimit(requireAccess(http.HandlerFunc(controller.GrantBusinessConsent))))
	mux.Handle("DELETE "+consents+"/{consentID}", rateLimit(requireAccess(http.HandlerFunc(controller.RevokeBusinessConsent))))
	authorizations := "/api/v1/account/business-messaging/authorizations"
	mux.Handle("GET "+authorizations, rateLimit(requireAccess(http.HandlerFunc(controller.ListBusinessAuthorizations))))
	mux.Handle("POST "+authorizations, rateLimit(requireAccess(http.HandlerFunc(controller.GrantBusinessAuthorization))))
	mux.Handle("DELETE "+authorizations+"/{authorizationID}", rateLimit(requireAccess(http.HandlerFunc(controller.RevokeBusinessAuthorization))))
}
