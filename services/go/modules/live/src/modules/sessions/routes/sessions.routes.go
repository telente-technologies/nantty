package routes

import (
	"net/http"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/middlewares"
	"zudomart/modules/live/src/modules/sessions/controllers"
)

func MountSessionsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.SessionsController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	optional := middlewares.OptionallyAuthenticated(deployed)
	mux.Handle("POST /api/v1/lives", authenticated(controller.CreateLiveSession))
	mux.Handle("GET /api/v1/lives/suggested", authenticated(controller.ListSuggestedLives))
	mux.Handle("GET /api/v1/lives/{liveId}", optional(controller.GetLiveSession))
	mux.Handle("GET /api/v1/users/{userId}/live", optional(controller.GetHostLiveStatus))
	mux.Handle("PATCH /api/v1/lives/{liveId}", authenticated(controller.UpdateLiveDetails))
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
