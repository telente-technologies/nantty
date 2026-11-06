package routes

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/middlewares"
	"nantty/modules/live/src/modules/sessions/controllers"
)

func MountSessionsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.SessionsController{Container: deployed}
	spaces := controllers.SpacesController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	idempotent := middlewares.Idempotent(deployed)
	optional := middlewares.OptionallyAuthenticated(deployed)
	mux.Handle("GET /api/v1/spaces", optional(http.HandlerFunc(spaces.List)))
	mux.Handle("GET /api/v1/spaces/invitations", authenticated(http.HandlerFunc(spaces.ListMyInvitations)))
	mux.Handle("GET /api/v1/spaces/{spaceId}", optional(http.HandlerFunc(spaces.Detail)))
	mux.Handle("POST /api/v1/spaces", idempotent(spaces.Create))
	mux.Handle("POST /api/v1/spaces/{spaceId}/start", idempotent(spaces.Start))
	mux.Handle("POST /api/v1/spaces/{spaceId}/end", idempotent(spaces.End))
	mux.Handle("POST /api/v1/spaces/{spaceId}/cancel", idempotent(spaces.Cancel))
	mux.Handle("POST /api/v1/spaces/{spaceId}/media-token", authenticated(http.HandlerFunc(spaces.MediaToken)))
	mux.Handle("POST /api/v1/spaces/{spaceId}/join", idempotent(spaces.Join))
	mux.Handle("POST /api/v1/spaces/{spaceId}/invites", idempotent(spaces.Invite))
	mux.Handle("POST /api/v1/spaces/{spaceId}/invites/{invitationId}/accept", idempotent(spaces.AcceptInvite))
	mux.Handle("POST /api/v1/spaces/{spaceId}/invites/{invitationId}/decline", idempotent(spaces.DeclineInvite))
	mux.Handle("PATCH /api/v1/spaces/{spaceId}/coin-donations", idempotent(spaces.UpdateCoinDonations))
	mux.Handle("POST /api/v1/spaces/{spaceId}/coin-donations", idempotent(spaces.SendCoinDonation))
	mux.Handle("POST /api/v1/spaces/{spaceId}/announcement", idempotent(spaces.AttachAnnouncement))
	mux.Handle("POST /api/v1/spaces/{spaceId}/leave", idempotent(spaces.Leave))
	mux.Handle("POST /api/v1/spaces/{spaceId}/speaker-requests", idempotent(spaces.SpeakerRequest))
	mux.Handle("POST /api/v1/spaces/{spaceId}/speaker-requests/{requestId}/approve", idempotent(spaces.ApproveSpeakerRequest))
	mux.Handle("POST /api/v1/spaces/{spaceId}/speaker-requests/{requestId}/decline", idempotent(spaces.DeclineSpeakerRequest))
	mux.Handle("POST /api/v1/spaces/{spaceId}/speakers/{userId}/mute", idempotent(spaces.MuteSpeaker))
	mux.Handle("POST /api/v1/spaces/{spaceId}/speakers/{userId}/remove", idempotent(spaces.RemoveSpeaker))
	mux.Handle("POST /api/v1/spaces/{spaceId}/speakers/{userId}/demote", idempotent(spaces.DemoteSpeaker))
	mux.Handle("POST /api/v1/lives", authenticated(controller.CreateLiveSession))
	mux.Handle("GET /api/v1/lives/suggested", authenticated(controller.ListSuggestedLives))
	mux.Handle("GET /api/v1/lives/{liveId}", optional(controller.GetLiveSession))
	mux.Handle("GET /api/v1/users/{userId}/live", optional(controller.GetHostLiveStatus))
	mux.Handle("PATCH /api/v1/lives/{liveId}", authenticated(controller.UpdateLiveDetails))
	mux.Handle("PATCH /api/v1/lives/{liveId}/coin-support", idempotent(controller.UpdateLiveCoinSupport))
	mux.Handle("POST /api/v1/lives/{liveId}/cancel", authenticated(controller.CancelLiveSession))
	mux.Handle("GET /api/v1/lives/{liveId}/safety", authenticated(controller.GetLiveSafety))
	mux.Handle("POST /api/v1/lives/{liveId}/start", authenticated(controller.StartLiveSession))
	mux.Handle("POST /api/v1/lives/{liveId}/end", authenticated(controller.EndLiveSession))
	mux.Handle("POST /api/v1/lives/{liveId}/heartbeat", authenticated(controller.RecordHostHeartbeat))
	mux.Handle("POST /api/v1/lives/{liveId}/join", authenticated(controller.JoinLive))
	mux.Handle("POST /api/v1/lives/{liveId}/leave", authenticated(controller.LeaveLive))
	mux.Handle("POST /api/v1/lives/{liveId}/reactions", authenticated(controller.AcknowledgeReaction))
	mux.Handle("POST /api/v1/lives/{liveId}/share", authenticated(controller.ShareLive))
	mux.Handle("PUT /api/v1/lives/{liveId}/monetization", authenticated(controller.UpdateLiveMonetization))
	mux.Handle("POST /api/v1/lives/{liveId}/media-token", authenticated(controller.IssueMediaToken))
	mux.Handle("POST /api/v1/lives/{liveId}/pins", authenticated(controller.PinProduct))
	mux.Handle("DELETE /api/v1/lives/{liveId}/pins", authenticated(controller.UnpinProduct))
	mux.Handle("GET /api/v1/lives/{liveId}/products", authenticated(controller.ListLiveProducts))
}
