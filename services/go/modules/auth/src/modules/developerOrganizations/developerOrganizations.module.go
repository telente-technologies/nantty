package developerorganizations

import (
	"net/http"

	"nantty/modules/auth/src/container"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

func Mount(mux *http.ServeMux, app *container.Container) {
	controller := Controller{Container: app}
	invitations := InvitationController{Container: app}
	requireAccess := jwtauth.RequireVerifiedAccessToken(app.AccessVerifier)
	requireStepUp := jwtauth.RequireUserStepUp(app.AccessVerifier)
	rateLimit := httpserver.RateLimitEveryRequest(false)
	base := "/api/v1/developer/organizations"
	mux.Handle("GET "+base, rateLimit(requireAccess(http.HandlerFunc(controller.List))))
	mux.Handle("POST "+base, rateLimit(requireAccess(http.HandlerFunc(controller.Create))))
	mux.Handle("GET "+base+"/{organizationID}", rateLimit(requireAccess(http.HandlerFunc(controller.Get))))
	mux.Handle("PATCH "+base+"/{organizationID}", rateLimit(requireAccess(http.HandlerFunc(controller.Update))))
	mux.Handle("GET "+base+"/{organizationID}/roles", rateLimit(requireAccess(http.HandlerFunc(controller.Roles))))
	mux.Handle("GET "+base+"/{organizationID}/audit-log", rateLimit(requireAccess(http.HandlerFunc(controller.AuditLog))))
	mux.Handle("GET "+base+"/{organizationID}/members", rateLimit(requireAccess(http.HandlerFunc(controller.Members))))
	mux.Handle("GET "+base+"/{organizationID}/members/{memberID}", rateLimit(requireAccess(http.HandlerFunc(controller.Member))))
	mux.Handle("PATCH "+base+"/{organizationID}/members/{memberID}", rateLimit(requireAccess(http.HandlerFunc(controller.UpdateMemberRole))))
	mux.Handle("DELETE "+base+"/{organizationID}/members/{memberID}", rateLimit(requireAccess(http.HandlerFunc(controller.RemoveMember))))
	mux.Handle("GET "+base+"/{organizationID}/access", rateLimit(requireAccess(http.HandlerFunc(controller.Access))))
	mux.Handle("POST "+base+"/{organizationID}/ownership-transfer", rateLimit(requireAccess(requireStepUp(http.HandlerFunc(controller.TransferOwnership)))))
	mux.Handle("GET "+base+"/{organizationID}/invitations", rateLimit(requireAccess(http.HandlerFunc(invitations.ListForOrganization))))
	mux.Handle("POST "+base+"/{organizationID}/invitations", rateLimit(requireAccess(http.HandlerFunc(invitations.Create))))
	mux.Handle("POST "+base+"/{organizationID}/invitations/{invitationID}/resend", rateLimit(requireAccess(http.HandlerFunc(invitations.Resend))))
	mux.Handle("DELETE "+base+"/{organizationID}/invitations/{invitationID}", rateLimit(requireAccess(http.HandlerFunc(invitations.Revoke))))
	mux.Handle("GET /api/v1/developer/invitations", rateLimit(requireAccess(http.HandlerFunc(invitations.ListForAccount))))
	mux.Handle("POST /api/v1/developer/invitations/{invitationID}", rateLimit(requireAccess(http.HandlerFunc(invitations.Respond))))
}
