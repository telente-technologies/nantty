package routes

import (
	"net/http"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/modules/auditLog/controllers"
)

func MountAuditLogRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.AuditLogController{Container: container}
	read := container.Guard.RequireStaff("audit:read", false)
	mux.Handle("GET /api/v1/admin/audit", read(http.HandlerFunc(controller.Search)))
	mux.Handle("GET /api/v1/admin/audit/facets", read(http.HandlerFunc(controller.Facets)))
	mux.Handle("GET /api/v1/admin/audit/export", container.Guard.RequireStaff("audit:export", false)(http.HandlerFunc(controller.Export)))
	mux.HandleFunc("POST /api/v1/internal/audit/events", controller.RecordFromService)
	mux.HandleFunc("POST /api/v1/internal/admin/audit-entries", controller.RecordNotificationAudit)
	mux.HandleFunc("GET /api/v1/internal/audit/history", controller.HistoryForService)
	mux.Handle("GET /api/v1/admin/audit/{entryId}", read(http.HandlerFunc(controller.Get)))
}
