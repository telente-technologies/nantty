package routes

import (
	"net/http"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/middlewares"
	"zudomart/modules/moderation/src/modules/liveSafety/controllers"
	"zudomart/platform/jwtauth"
)

func MountLiveSafetyRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.LiveSafetyController{Container: container}
	staff := func(stepUp bool) func(http.Handler) http.Handler {
		return middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, []string{"moderation:reports"}, stepUp)
	}
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	mux.Handle("GET /api/v1/admin/live-incidents", staff(false)(http.HandlerFunc(controller.List)))
	mux.Handle("GET /api/v1/admin/live-incidents/{incidentId}", staff(false)(http.HandlerFunc(controller.Detail)))
	mux.Handle("POST /api/v1/admin/live-incidents/{incidentId}/actions", staff(false)(http.HandlerFunc(controller.Act)))
	mux.Handle("POST /api/v1/admin/live-incidents/{incidentId}/end-and-suspend", staff(true)(http.HandlerFunc(controller.EndAndSuspend)))
	mux.Handle("POST /api/v1/live-safety/{liveId}/appeal", requireAccessToken(http.HandlerFunc(controller.Appeal)))
}
