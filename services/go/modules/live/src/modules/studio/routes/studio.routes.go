package routes

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/middlewares"
	"nantty/modules/live/src/modules/studio/controllers"
)

func MountStudioRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.StudioController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	mux.Handle("GET /api/v1/lives", authenticated(controller.ListMyLives))
	mux.Handle("POST /api/v1/lives/{liveId}/stream-key", authenticated(controller.IssueStreamKey))
	mux.Handle("GET /api/v1/lives/{liveId}/stream-key", authenticated(controller.GetStreamKey))
	mux.Handle("DELETE /api/v1/lives/{liveId}/stream-key", authenticated(controller.RevokeStreamKey))
	mux.Handle("GET /api/v1/lives/{liveId}/recordings", authenticated(controller.ListRecordings))
	mux.Handle("PUT /api/v1/lives/{liveId}/recording", authenticated(controller.SetRecording))
	mux.Handle("DELETE /api/v1/lives/{liveId}/recordings/{recordingId}", authenticated(controller.DeleteRecording))
	mux.Handle("POST /api/v1/lives/{liveId}/recordings/{recordingId}/repost", authenticated(controller.RepostRecording))
	mux.Handle("GET /api/v1/lives/{liveId}/stream-health", authenticated(controller.GetStreamHealth))
	mux.Handle("GET /api/v1/live/host-defaults", authenticated(controller.GetHostDefaults))
	mux.Handle("PUT /api/v1/live/host-defaults", authenticated(controller.UpdateHostDefaults))
	if deployed.Settings.LiveKitWebhookEnabled {
		mux.HandleFunc("POST /api/v1/live/webhooks/livekit", controller.ReceiveLiveKitWebhook)
	}
}
