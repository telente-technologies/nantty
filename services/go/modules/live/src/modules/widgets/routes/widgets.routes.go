package routes

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/modules/widgets/controllers"
	"nantty/platform/jwtauth"
)

func MountWidgetRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.NewWidgetsController(deployed)
	mux.Handle("GET /api/v1/widgets/live-now", jwtauth.RequireAccessTokenOrWidgetToken(deployed.AccessVerifier)(http.HandlerFunc(controller.LiveNow)))
}
