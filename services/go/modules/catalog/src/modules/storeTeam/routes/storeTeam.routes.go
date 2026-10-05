package routes

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	"zudomart/modules/catalog/src/modules/storeTeam/controllers"
)

func MountStoreTeamRoutes(mux *http.ServeMux, deployed *container.Container) {
	team := controllers.StoreTeamController{Container: deployed}
	requests := controllers.TeamRequestsController{Container: deployed}
	staffManager := middlewares.StoreMember(deployed, "staff:manage", false)
	mux.Handle("GET /api/v1/seller/zudomart-users", middlewares.StoreMember(deployed, "dashboard:view", false)(team.SearchZudomartUsers))
	mux.Handle("GET /api/v1/seller/staff/candidates", staffManager(team.SearchStaffCandidates))
	mux.Handle("GET /api/v1/seller/staff", staffManager(team.ListStaff))
	mux.Handle("POST /api/v1/seller/staff", middlewares.StoreMemberFeatureWithOptionalKey(deployed, "staff:manage", "team")(team.AddStaff))
	mux.Handle("PATCH /api/v1/seller/staff/{staffId}", middlewares.StoreMemberWithOptionalKey(deployed, "staff:manage")(team.UpdateStaff))
	mux.Handle("DELETE /api/v1/seller/staff/{staffId}", staffManager(team.RemoveStaff))
	mux.Handle("GET /api/v1/seller/audit-log", middlewares.StoreMember(deployed, "audit:view", false)(team.ListAuditLog))
	mux.Handle("GET /api/v1/stores/team-requests", middlewares.Authenticated(deployed)(requests.List))
	mux.Handle("POST /api/v1/stores/team-requests/{requestId}/accept", middlewares.OptionallyIdempotent(deployed)(requests.Accept))
	mux.Handle("POST /api/v1/stores/team-requests/{requestId}/decline", middlewares.OptionallyIdempotent(deployed)(requests.Decline))
}
