package routes

import (
	"net/http"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/modules/staffAdmins/controllers"
)

func MountStaffAdminsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.StaffAdminsController{Container: container}
	requireStaffRead := container.Guard.RequireStaff("admin.staff.read", false)
	requireSuperadminStepUp := container.Guard.RequireStaff("", true)
	mux.Handle("GET /api/v1/admin/admins", requireStaffRead(http.HandlerFunc(controller.List)))
	mux.Handle("POST /api/v1/admin/admins", requireSuperadminStepUp(http.HandlerFunc(controller.Invite)))
	mux.Handle("PATCH /api/v1/admin/admins/{staffId}/permissions", requireSuperadminStepUp(http.HandlerFunc(controller.ChangePermissions)))
	mux.Handle("POST /api/v1/admin/admins/{staffId}/disable", requireSuperadminStepUp(http.HandlerFunc(controller.Disable)))
}
