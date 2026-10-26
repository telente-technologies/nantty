package routes

import (
	"net/http"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/platformSettings/controllers"
)

func MountPlatformSettingsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.PlatformSettingsController{Container: container}
	configPermissions := []string{"config:read", "config:plans", "config:revenue", "config:rules", "settings:edit"}
	requireRead := container.Guard.RequireStaffWithAnyPermission(configPermissions, false)
	requireWrite := container.Guard.RequireStaffWithAnyPermission(configPermissions[1:], true)
	mux.Handle("GET /api/v1/admin/config", requireRead(http.HandlerFunc(controller.List)))
	mux.Handle("GET /api/v1/admin/config/{key}", requireRead(http.HandlerFunc(controller.Get)))
	mux.Handle("PUT /api/v1/admin/config/{key}", requireWrite(http.HandlerFunc(controller.Update)))
	mux.Handle("GET /api/v1/admin/config/{key}/versions", requireRead(http.HandlerFunc(controller.ListVersions)))
	mux.Handle("POST /api/v1/admin/config/{key}/versions/{version}/restore", requireWrite(http.HandlerFunc(controller.RestoreVersion)))
	trendingPermissions := []string{"content:review", "moderation:reports", "settings:edit"}
	mux.Handle("GET /api/v1/admin/trending/moderation", container.Guard.RequireStaffWithAnyPermission(trendingPermissions, false)(http.HandlerFunc(controller.GetTrendingModeration)))
	mux.Handle("PUT /api/v1/admin/trending/moderation", container.Guard.RequireStaffWithAnyPermission(trendingPermissions, true)(http.HandlerFunc(controller.UpdateTrendingModeration)))
	mux.HandleFunc("GET /api/v1/platform-config/creator-requirements", controller.PublicCreatorRequirements)
	mux.HandleFunc("GET /api/v1/internal/platform-config/{key}", controller.InternalRead)
}
