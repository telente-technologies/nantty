package routes

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/linkedProfiles/controllers"
	"zudomart/platform/httpserver"
	"zudomart/platform/identityports"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

var readPermissions = []string{"users:read", "support:tickets", "users:moderate"}

func MountLinkedProfilesRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.LinkedProfilesController{Container: container}
	internalToken := httpserver.RequireInternalToken(container.Settings.Privacy.InternalApiToken)
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	requireStepUp := jwtauth.RequireUserStepUp(container.AccessVerifier)
	guard := staffauth.Guard{Registry: identityports.Default}
	mux.Handle("GET /api/v1/users/me/linked-profiles", requireAccessToken(http.HandlerFunc(controller.Mine)))
	mux.Handle("POST /api/v1/users/me/linked-profiles/choose", requireAccessToken(requireStepUp(http.HandlerFunc(controller.Choose))))
	mux.Handle("GET /api/v1/internal/accounts/{accountId}/linked-profiles", internalToken(http.HandlerFunc(controller.InternalSummary)))
	mux.Handle("POST /api/v1/internal/accounts/{accountId}/linked-profiles/claim", internalToken(http.HandlerFunc(controller.InternalClaim)))
	mux.Handle("POST /api/v1/internal/accounts/{accountId}/linked-profiles/release", internalToken(http.HandlerFunc(controller.InternalRelease)))
	mux.Handle("POST /api/v1/internal/accounts/{accountId}/linked-profiles/transfer-brand", internalToken(http.HandlerFunc(controller.InternalTransferBrand)))
	mux.Handle("GET /api/v1/admin/linked-profiles/conflicts", guard.RequireStaffWithAnyPermission(readPermissions, false)(http.HandlerFunc(controller.AdminConflicts)))
	mux.Handle("GET /api/v1/admin/users/{userId}/linked-profiles", guard.RequireStaffWithAnyPermission(readPermissions, false)(http.HandlerFunc(controller.AdminSummary)))
	mux.Handle("POST /api/v1/admin/users/{userId}/linked-profiles/convert", guard.RequireStaff("users:moderate", true)(http.HandlerFunc(controller.AdminConvert)))
	mux.Handle("POST /api/v1/admin/users/{userId}/linked-profiles/resolve", guard.RequireStaff("users:moderate", true)(http.HandlerFunc(controller.AdminResolve)))
}
