package routes

import (
	"net/http"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/middlewares"
	"nantty/modules/moderation/src/modules/accountHealth/controllers"
	"nantty/platform/jwtauth"
)

func MountAccountHealthRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.AccountHealthController{Container: container}
	requireAccessTokenAllowingSuspended := jwtauth.RequireVerifiedAccessTokenAllowingSuspended(container.AccessVerifier)
	usersReader := middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, []string{"users:read", "copyright:review"}, false)
	appealReviewer := middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, []string{"moderation:appeals", "copyright:review"}, false)
	appealOverturner := middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, []string{"moderation:appeals", "copyright:review"}, true)
	monetisationOverrider := middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, []string{"users:suspend", "moderation:appeals"}, true)
	internal := middlewares.RequireInternalToken(container.Settings.IntakeToken)
	mux.Handle("GET /api/v1/account/status", requireAccessTokenAllowingSuspended(http.HandlerFunc(controller.Mine)))
	mux.Handle("POST /api/v1/account/status/strikes/{strikeId}/appeal", requireAccessTokenAllowingSuspended(http.HandlerFunc(controller.Appeal)))
	mux.Handle("GET /api/v1/admin/account-health/{accountId}", usersReader(http.HandlerFunc(controller.ForAccount)))
	mux.Handle("GET /api/v1/admin/strike-appeals", appealReviewer(http.HandlerFunc(controller.ListAppeals)))
	mux.Handle("POST /api/v1/admin/strike-appeals/{strikeId}/uphold", appealReviewer(controller.DecideAppeal("uphold")))
	mux.Handle("POST /api/v1/admin/strike-appeals/{strikeId}/overturn", appealOverturner(controller.DecideAppeal("overturn")))
	mux.Handle("PUT /api/v1/admin/account-health/{accountId}/monetisation-override", monetisationOverrider(http.HandlerFunc(controller.SetMonetisationOverride)))
	mux.Handle("DELETE /api/v1/admin/account-health/{accountId}/monetisation-override", monetisationOverrider(http.HandlerFunc(controller.ClearMonetisationOverride)))
	mux.Handle("GET /api/v1/internal/accounts/{accountId}/health", internal(http.HandlerFunc(controller.ForAccount)))
}
