package routes

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/middlewares"
	"nantty/modules/live/src/modules/internalApi/controllers"
)

func MountInternalApiRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.InternalApiController{Container: deployed}
	internal := middlewares.InternalToken(deployed)
	mux.Handle("GET /api/v1/internal/share-cards/live/{id}", internal(controller.GetShareCard))
	mux.Handle("GET /api/v1/internal/live/topic-access", internal(controller.GetTopicAccess))
	mux.Handle("GET /api/v1/internal/live/{liveId}/ad-eligibility", internal(controller.GetAdEligibility))
	mux.Handle("POST /api/v1/internal/live/{liveId}/presence", internal(controller.ApplyPresence))
	mux.Handle("GET /api/v1/internal/accounts/{accountId}/activity-counts", internal(controller.GetAccountActivityCounts))
	mux.Handle("GET /api/v1/internal/moderation/targets/{type}/{id}", internal(controller.GetModerationTarget))
	mux.Handle("PUT /api/v1/internal/live/{liveId}/recordings/legal-hold", internal(controller.SetRecordingLegalHold))
	mux.Handle("PUT /api/v1/internal/live/recordings/{recordingId}/repost", internal(controller.SetRecordingRepost))
}
