package routes

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/middlewares"
	"nantty/modules/live/src/modules/points/controllers"
)

func MountPointsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.PointsController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	mux.Handle("GET /api/v1/lives/{liveId}/points/me", authenticated(controller.GetMyLivePoints))
	mux.Handle("POST /api/v1/lives/{liveId}/engagement", authenticated(controller.AwardEngagement))
	mux.Handle("GET /api/v1/rankings", authenticated(controller.GetRankings))
}
