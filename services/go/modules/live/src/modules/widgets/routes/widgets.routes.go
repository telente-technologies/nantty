package routes

import (
	"net/http"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/modules/widgets/controllers"
	"zudomart/platform/jwtauth"
)

func MountWidgetRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.NewWidgetsController(deployed)
	mux.Handle("GET /api/v1/widgets/live-now", jwtauth.RequireAccessTokenOrWidgetToken(deployed.AccessVerifier)(http.HandlerFunc(controller.LiveNow)))
}
