package routes

import (
	"net/http"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/middlewares"
	"nantty/modules/moderation/src/modules/contentReports/controllers"
)

func MountContentReportsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.ContentReportsController{Container: container}
	staff := func(stepUp bool) func(http.Handler) http.Handler {
		return middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, []string{"moderation:reports"}, stepUp)
	}
	mux.Handle("GET /api/v1/admin/reports", staff(false)(http.HandlerFunc(controller.List)))
	mux.Handle("GET /api/v1/admin/reports/{reportId}", staff(false)(http.HandlerFunc(controller.Detail)))
	mux.Handle("POST /api/v1/admin/reports/{reportId}/actions", staff(false)(http.HandlerFunc(controller.Act)))
	mux.Handle("POST /api/v1/admin/reports/{reportId}/suspend-author", staff(true)(http.HandlerFunc(controller.SuspendAuthor)))
	mux.Handle("POST /api/v1/admin/reports/{reportId}/revoke-author-verification", staff(true)(http.HandlerFunc(controller.RevokeAuthorVerification)))
}
