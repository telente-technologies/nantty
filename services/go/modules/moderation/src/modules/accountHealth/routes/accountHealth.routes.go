package routes

import (
	"net/http"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/middlewares"
	"zudomart/modules/moderation/src/modules/accountHealth/controllers"
	"zudomart/platform/jwtauth"
)

func MountAccountHealthRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.AccountHealthController{Container: container}
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	usersReader := middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, []string{"users:read", "copyright:review"}, false)
	appealReviewer := middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, []string{"moderation:appeals", "copyright:review"}, false)
	internal := middlewares.RequireInternalToken(container.Settings.IntakeToken)
	mux.Handle("GET /api/v1/account/status", requireAccessToken(http.HandlerFunc(controller.Mine)))
	mux.Handle("POST /api/v1/account/status/strikes/{strikeId}/appeal", requireAccessToken(http.HandlerFunc(controller.Appeal)))
	mux.Handle("GET /api/v1/admin/account-health/{accountId}", usersReader(http.HandlerFunc(controller.ForAccount)))
	mux.Handle("GET /api/v1/admin/strike-appeals", appealReviewer(http.HandlerFunc(controller.ListAppeals)))
	mux.Handle("POST /api/v1/admin/strike-appeals/{strikeId}/uphold", appealReviewer(controller.DecideAppeal("uphold")))
	mux.Handle("POST /api/v1/admin/strike-appeals/{strikeId}/overturn", appealReviewer(controller.DecideAppeal("overturn")))
	mux.Handle("GET /api/v1/internal/accounts/{accountId}/health", internal(http.HandlerFunc(controller.ForAccount)))
}
