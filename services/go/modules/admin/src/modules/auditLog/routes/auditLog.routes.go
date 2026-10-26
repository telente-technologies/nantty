package routes

import (
	"net/http"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/auditLog/controllers"
	"nantty/platform/httpserver"
)

func MountAuditLogRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.AuditLogController{Container: container}
	internalToken := httpserver.RequireInternalToken(container.Settings.InternalApiToken)
	read := container.Guard.RequireStaff("audit:read", false)
	mux.Handle("GET /api/v1/admin/audit", read(http.HandlerFunc(controller.Search)))
	mux.Handle("GET /api/v1/admin/audit/facets", read(http.HandlerFunc(controller.Facets)))
	mux.Handle("GET /api/v1/admin/audit/export", container.Guard.RequireStaff("audit:export", false)(http.HandlerFunc(controller.Export)))
	mux.Handle("POST /api/v1/internal/audit/events", internalToken(http.HandlerFunc(controller.RecordFromService)))
	mux.Handle("POST /api/v1/internal/admin/audit-entries", internalToken(http.HandlerFunc(controller.RecordNotificationAudit)))
	mux.Handle("GET /api/v1/internal/audit/history", internalToken(http.HandlerFunc(controller.HistoryForService)))
	mux.Handle("GET /api/v1/admin/audit/{entryId}", read(http.HandlerFunc(controller.Get)))
}
