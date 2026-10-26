package routes

import (
	"net/http"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/middlewares"
	"nantty/modules/ads/src/modules/adAccounts/controllers"
)

func MountAdAccountsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.AdAccountsController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	idempotent := middlewares.Idempotent(deployed)
	mux.Handle("GET /api/v1/ads/memberships", authenticated(controller.ListMemberships))
	mux.Handle("GET /api/v1/ads/verification", authenticated(controller.GetVerification))
	mux.Handle("GET /api/v1/ads/accounts", authenticated(controller.ListAccounts))
	mux.Handle("POST /api/v1/ads/accounts", idempotent(controller.CreateAccount))
	mux.Handle("GET /api/v1/ads/business-profiles", authenticated(controller.ListBusinessProfiles))
	mux.Handle("GET /api/v1/ads/accounts/{accountId}", authenticated(controller.GetAccount))
	mux.Handle("PATCH /api/v1/ads/accounts/{accountId}", authenticated(controller.UpdateAccount))
	mux.Handle("GET /api/v1/ads/accounts/{accountId}/entitlements", authenticated(controller.GetEntitlements))
	mux.Handle("GET /api/v1/ads/accounts/{accountId}/members", authenticated(controller.ListMembers))
	mux.Handle("PATCH /api/v1/ads/accounts/{accountId}/members/{userId}", authenticated(controller.ChangeMemberRole))
	mux.Handle("DELETE /api/v1/ads/accounts/{accountId}/members/{userId}", authenticated(controller.RemoveMember))
	mux.Handle("GET /api/v1/ads/accounts/{accountId}/invites", authenticated(controller.ListInvites))
	mux.Handle("POST /api/v1/ads/accounts/{accountId}/invites", authenticated(controller.InviteMember))
	mux.Handle("DELETE /api/v1/ads/accounts/{accountId}/invites/{inviteId}", authenticated(controller.RevokeInvite))
	mux.Handle("GET /api/v1/ads/invites", authenticated(controller.ListMyInvites))
	mux.Handle("GET /api/v1/ads/invites/{inviteId}", authenticated(controller.PreviewInvite))
	mux.Handle("POST /api/v1/ads/invites/{inviteId}/accept", authenticated(controller.AcceptInvite))
	mux.Handle("GET /api/v1/ads/accounts/{accountId}/activity", authenticated(controller.ListActivity))
}
