package routes

import (
	"net/http"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/modules/auditLog/controllers"
)

func MountAuditLogRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.AuditLogController{Container: container}
	mux.Handle("GET /api/v1/admin/audit", container.Guard.RequireStaff("admin.audit.read", false)(http.HandlerFunc(controller.Search)))
	mux.Handle("GET /api/v1/admin/audit/export", container.Guard.RequireStaff("admin.audit.read", true)(http.HandlerFunc(controller.Export)))
}
