package routes

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/middlewares"
	"nantty/modules/live/src/modules/stage/controllers"
)

func MountStageRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.StageController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	mux.Handle("GET /api/v1/lives/{liveId}/stage", authenticated(controller.GetLiveStage))
	mux.Handle("GET /api/v1/lives/{liveId}/viewers", authenticated(controller.SearchViewersToInvite))
	mux.Handle("POST /api/v1/lives/{liveId}/guests/invitations", authenticated(controller.InviteGuest))
	mux.Handle("DELETE /api/v1/lives/{liveId}/guests/invitations/{slotId}", authenticated(controller.CancelGuestInvitation))
	mux.Handle("POST /api/v1/lives/{liveId}/guests/invitations/{slotId}/{response}", authenticated(controller.RespondToInvitation))
	mux.Handle("POST /api/v1/lives/{liveId}/guests/requests", authenticated(controller.RequestToJoinStage))
	mux.Handle("POST /api/v1/lives/{liveId}/guests/requests/{requestId}/{decision}", authenticated(controller.DecideJoinRequest))
	mux.Handle("POST /api/v1/lives/{liveId}/guests/{userId}/remove", authenticated(controller.RemoveGuest))
	mux.Handle("POST /api/v1/lives/{liveId}/guests/{userId}/mute", authenticated(controller.MuteStreamer))
	mux.Handle("POST /api/v1/lives/{liveId}/guests/me/leave", authenticated(controller.LeaveStage))
	mux.Handle("POST /api/v1/lives/{liveId}/guests/me/connection", authenticated(controller.ReportGuestConnection))
}
