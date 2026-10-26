package routes

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/middlewares"
	"nantty/modules/live/src/modules/comments/controllers"
)

func MountCommentsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.CommentsController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	mux.Handle("GET /api/v1/lives/{liveId}/comments", authenticated(controller.ListComments))
	mux.Handle("POST /api/v1/lives/{liveId}/comments", authenticated(controller.PostComment))
	mux.Handle("DELETE /api/v1/lives/{liveId}/comments/{commentId}", authenticated(controller.DeleteComment))
	mux.Handle("PUT /api/v1/lives/{liveId}/comments/{commentId}/pin", authenticated(controller.PinComment))
	mux.Handle("DELETE /api/v1/lives/{liveId}/pinned-comment", authenticated(controller.UnpinComment))
	mux.Handle("GET /api/v1/lives/{liveId}/room-settings", authenticated(controller.GetRoomSettings))
	mux.Handle("PUT /api/v1/lives/{liveId}/room-settings", authenticated(controller.UpdateRoomSettings))
	mux.Handle("GET /api/v1/lives/{liveId}/moderators", authenticated(controller.ListModerators))
	mux.Handle("PUT /api/v1/lives/{liveId}/moderators/{userId}", authenticated(controller.GrantModerator))
	mux.Handle("DELETE /api/v1/lives/{liveId}/moderators/{userId}", authenticated(controller.RevokeModerator))
	mux.Handle("PUT /api/v1/lives/{liveId}/viewers/{userId}/mute", authenticated(controller.MuteViewer))
	mux.Handle("DELETE /api/v1/lives/{liveId}/viewers/{userId}/mute", authenticated(controller.UnmuteViewer))
	mux.Handle("PUT /api/v1/lives/{liveId}/viewers/{userId}/ban", authenticated(controller.BanViewer))
	mux.Handle("DELETE /api/v1/lives/{liveId}/viewers/{userId}/ban", authenticated(controller.UnbanViewer))
}
