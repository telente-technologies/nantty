package routes

import (
	"net/http"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/staffAdmins/controllers"
)

func MountStaffAdminsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.StaffAdminsController{Container: container}
	manage := container.Guard.RequireStaff("staff:manage", false)
	manageWithStepUp := container.Guard.RequireStaff("staff:manage", true)
	superadminStepUp := container.Guard.RequireSuperadmin(true)
	mux.Handle("GET /api/v1/admin/admins", manage(http.HandlerFunc(controller.List)))
	mux.Handle("GET /api/v1/admin/admins/{staffId}", manage(http.HandlerFunc(controller.Detail)))
	mux.Handle("POST /api/v1/admin/admins", manageWithStepUp(http.HandlerFunc(controller.Create)))
	mux.Handle("PATCH /api/v1/admin/admins/{staffId}", manageWithStepUp(http.HandlerFunc(controller.Update)))
	mux.Handle("PUT /api/v1/admin/admins/{staffId}/permissions", manageWithStepUp(http.HandlerFunc(controller.ChangePermissions)))
	mux.Handle("PATCH /api/v1/admin/admins/{staffId}/permissions", manageWithStepUp(http.HandlerFunc(controller.ChangePermissions)))
	mux.Handle("POST /api/v1/admin/admins/{staffId}/disable", manageWithStepUp(http.HandlerFunc(controller.Disable)))
	mux.Handle("POST /api/v1/admin/admins/{staffId}/enable", manageWithStepUp(http.HandlerFunc(controller.Enable)))
	mux.Handle("POST /api/v1/admin/admins/{staffId}/reset-mfa", manageWithStepUp(http.HandlerFunc(controller.ResetMfa)))
	mux.Handle("POST /api/v1/admin/admins/{staffId}/suspend", manageWithStepUp(http.HandlerFunc(controller.Suspend)))
	mux.Handle("POST /api/v1/admin/admins/{staffId}/revoke", manageWithStepUp(http.HandlerFunc(controller.Revoke)))
	mux.Handle("POST /api/v1/admin/admins/{staffId}/approve", superadminStepUp(http.HandlerFunc(controller.ApproveSuperadmin)))
	mux.HandleFunc("GET /api/v1/internal/admins/{staffId}/notification-recipient", controller.NotificationRecipient)
	mux.HandleFunc("GET /api/v1/internal/admins/{staffId}/network-policy", controller.NetworkPolicy)
	mux.Handle("GET /api/v1/admin/roles", manage(http.HandlerFunc(controller.ListRoles)))
	mux.Handle("POST /api/v1/admin/roles", manageWithStepUp(http.HandlerFunc(controller.CreateRole)))
	mux.Handle("GET /api/v1/admin/staff-settings", manage(http.HandlerFunc(controller.GetSettings)))
	mux.Handle("PUT /api/v1/admin/staff-settings", superadminStepUp(http.HandlerFunc(controller.UpdateSettings)))
}
