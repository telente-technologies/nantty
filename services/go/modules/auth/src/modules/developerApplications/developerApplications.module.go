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
}
