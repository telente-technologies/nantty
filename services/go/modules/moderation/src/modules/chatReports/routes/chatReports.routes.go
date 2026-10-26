package routes

import (
	"net/http"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/middlewares"
	"nantty/modules/moderation/src/modules/chatReports/controllers"
	"nantty/platform/jwtauth"
)

func MountChatReportsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.ChatReportsController{Container: container}
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	staff := func(stepUp bool, permissions ...string) func(http.Handler) http.Handler {
		return middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, permissions, stepUp)
	}
	mux.Handle("POST /api/v1/reports", requireAccessToken(http.HandlerFunc(controller.Submit)))
	mux.Handle("GET /api/v1/reports/me", requireAccessToken(http.HandlerFunc(controller.Mine)))
	mux.Handle("GET /api/v1/admin/chat-reports", staff(false, "chat-reports:review", "chat-reports:legal")(http.HandlerFunc(controller.List)))
	mux.Handle("GET /api/v1/admin/chat-reports/retention", staff(false, "chat-reports:review", "chat-reports:legal")(http.HandlerFunc(controller.GetRetention)))
	mux.Handle("PUT /api/v1/admin/chat-reports/retention", staff(true, "chat-reports:legal")(http.HandlerFunc(controller.PutRetention)))
	mux.Handle("GET /api/v1/admin/chat-reports/{reportId}", staff(false, "chat-reports:review", "chat-reports:legal")(http.HandlerFunc(controller.Detail)))
	mux.Handle("POST /api/v1/admin/chat-reports/{reportId}/actions", staff(false, "chat-reports:review", "chat-reports:legal")(http.HandlerFunc(controller.Act)))
}
