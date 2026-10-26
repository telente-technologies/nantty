package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/usernames/controllers"
	"nantty/platform/httpserver"
	"nantty/platform/identityports"
	"nantty/platform/jwtauth"
	"nantty/platform/staffauth"
)

const (
	permissionRead     = "users.usernames.read"
	permissionReserve  = "users.usernames.reserve"
	permissionWithhold = "users.usernames.withhold"
)

func MountUsernamesRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.UsernamesController{Container: container}
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	guard := staffauth.Guard{Registry: identityports.Default}
	rateLimitAuth := httpserver.RateLimitAuthEndpoints()
	mux.Handle("GET /api/v1/users/me/username-policy", requireAccessToken(http.HandlerFunc(controller.GetUsernamePolicy)))
	mux.Handle("PATCH /api/v1/users/me/username", requireAccessToken(http.HandlerFunc(controller.ChangeUsername)))
	mux.Handle("GET /api/v1/auth/username-suggestion", rateLimitAuth(http.HandlerFunc(controller.SuggestUsername)))
	mux.Handle("GET /api/v1/admin/usernames/reserved", guard.RequireStaff(permissionRead, false)(http.HandlerFunc(controller.ListReservedUsernameRules)))
	mux.Handle("POST /api/v1/admin/usernames/reserved", guard.RequireStaff(permissionReserve, true)(http.HandlerFunc(controller.AddReservedUsernameRule)))
	mux.Handle("DELETE /api/v1/admin/usernames/reserved/{ruleId}", guard.RequireStaff(permissionReserve, true)(http.HandlerFunc(controller.RemoveReservedUsernameRule)))
	mux.Handle("POST /api/v1/admin/usernames/withheld", guard.RequireStaff(permissionWithhold, true)(http.HandlerFunc(controller.WithholdUsername)))
	mux.Handle("DELETE /api/v1/admin/usernames/withheld/{username}", guard.RequireStaff(permissionWithhold, true)(http.HandlerFunc(controller.ReleaseWithheldUsername)))
}
