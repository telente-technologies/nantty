package routes

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/accountEnforcement/controllers"
	"zudomart/platform/identityports"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

var readUserPermissions = []string{"users:read", "support:tickets", "verification:review", "moderation:reports"}
var usernameHoldPermissions = []string{"usernames:reassign", "reserved-usernames:manage"}
var usernameReadPermissions = []string{"users.usernames.read", "usernames:reassign"}

func MountAccountEnforcementRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.AccountEnforcementController{Container: container}
	guard := staffauth.Guard{Registry: identityports.Default}
	one := func(permission string, stepUp bool, handler http.HandlerFunc) http.Handler {
		return guard.RequireStaff(permission, stepUp)(handler)
	}
	any := func(permissions []string, handler http.HandlerFunc) http.Handler {
		return guard.RequireStaffWithAnyPermission(permissions, false)(handler)
	}
	mux.Handle("GET /api/v1/admin/users", any(readUserPermissions, controller.ListUsers))
	mux.Handle("GET /api/v1/admin/users/{userId}", any(readUserPermissions, controller.GetUser))
	mux.Handle("POST /api/v1/admin/users/{userId}/restrict", one("users:restrict", false, controller.Restrict))
	mux.Handle("POST /api/v1/admin/users/{userId}/suspend", one("users:suspend", false, controller.Suspend))
	mux.Handle("POST /api/v1/admin/users/{userId}/reinstate", one("users:suspend", false, controller.Reinstate))
	mux.Handle("POST /api/v1/admin/users/{userId}/ban", one("users:ban", true, controller.Ban))
	mux.Handle("POST /api/v1/admin/users/{userId}/unban", one("users:ban", true, controller.Unban))
	mux.Handle("POST /api/v1/admin/users/{userId}/delete", one("users:delete", true, controller.Delete))
	mux.Handle("POST /api/v1/admin/users/{userId}/username/reassign", one("usernames:reassign", true, controller.Reassign))
	mux.Handle("POST /api/v1/admin/users/{userId}/username/assign-held", one("usernames:reassign", true, controller.AssignHeld))
	mux.Handle("GET /api/v1/admin/users/{userId}/personal-data", one("users:read-pii", false, controller.RevealPersonalData))
	mux.Handle("POST /api/v1/admin/users/{userId}/warn", one("users:moderate", false, controller.Warn))
	mux.Handle("POST /api/v1/admin/users/{userId}/force-logout", one("users:moderate", false, controller.ForceLogout))
	mux.Handle("POST /api/v1/admin/users/{userId}/username/withhold", one("users.usernames.withhold", true, controller.WithholdUsername))
	mux.Handle("POST /api/v1/admin/users/{userId}/username/reclaim", one("users.usernames.withhold", true, controller.ReclaimUsername))
	mux.Handle("GET /api/v1/admin/usernames/withheld", any(usernameReadPermissions, controller.ListWithheld))
	mux.Handle("GET /api/v1/admin/usernames/confusables", any(usernameReadPermissions, controller.PreviewConfusables))
	mux.Handle("GET /api/v1/admin/usernames/held", any(usernameHoldPermissions, controller.ListHeld))
	mux.Handle("GET /api/v1/admin/usernames/hold", any(usernameHoldPermissions, controller.GetHold))
	mux.Handle("GET /api/v1/admin/suspensions/accounts", one("users:suspend", false, controller.ListSuspendedAccounts))
	mux.Handle("POST /api/v1/admin/suspensions/accounts/{caseId}/reinstate", one("users:suspend", true, controller.ReinstateSuspension))
	mux.Handle("POST /api/v1/admin/suspensions/accounts/{caseId}/appeal/decide", one("users:suspend", true, controller.DecideAppeal))
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	mux.Handle("GET /api/v1/users/me/suspension", requireAccessToken(http.HandlerFunc(controller.MySuspension)))
	mux.Handle("POST /api/v1/users/me/suspension/appeal", requireAccessToken(http.HandlerFunc(controller.SubmitAppeal)))
	mux.HandleFunc("POST /api/v1/internal/enforcement/actions", controller.InternalAction)
	mux.HandleFunc("POST /api/v1/internal/users/summaries", controller.InternalSummaries)
	mux.HandleFunc("POST /api/v1/internal/suspensions/{caseId}/appeal/decide", controller.InternalDecideAppeal)
}
