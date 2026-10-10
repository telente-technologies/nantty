package routes

import (
	"net/http"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/middlewares"
	"zudomart/modules/moderation/src/modules/appeals/controllers"
	"zudomart/platform/jwtauth"
)

func MountAppealsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.AppealsController{Container: container}
	reviewer := middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, []string{"moderation:appeals"}, false)
	requireAccessTokenAllowingSuspended := jwtauth.RequireVerifiedAccessTokenAllowingSuspended(container.AccessVerifier)
	mux.Handle("GET /api/v1/admin/appeals", reviewer(http.HandlerFunc(controller.List)))
	mux.Handle("GET /api/v1/admin/appeals/{appealId}", reviewer(http.HandlerFunc(controller.Detail)))
	mux.Handle("POST /api/v1/admin/appeals/{appealId}/decide", reviewer(http.HandlerFunc(controller.Decide)))
	mux.Handle("GET /api/v1/moderation/decisions/me", requireAccessTokenAllowingSuspended(http.HandlerFunc(controller.MyDecisions)))
	mux.Handle("POST /api/v1/moderation/decisions/{reportId}/appeal", requireAccessTokenAllowingSuspended(http.HandlerFunc(controller.Appeal)))
}
