package routes

import (
	"net/http"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/modules/platformSettings/controllers"
)

func MountPlatformSettingsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.PlatformSettingsController{Container: container}
	configPermissions := []string{"config:read", "config:plans", "config:revenue", "config:rules", "settings:edit"}
	requireRead := container.Guard.RequireStaffWithAnyPermission(configPermissions, false)
	requireWrite := container.Guard.RequireStaffWithAnyPermission(configPermissions[1:], true)
	mux.Handle("GET /api/v1/admin/config", requireRead(http.HandlerFunc(controller.List)))
	mux.Handle("GET /api/v1/admin/config/{key}", requireRead(http.HandlerFunc(controller.Get)))
	mux.Handle("PUT /api/v1/admin/config/{key}", requireWrite(http.HandlerFunc(controller.Update)))
	mux.HandleFunc("GET /api/v1/platform-config/creator-requirements", controller.PublicCreatorRequirements)
	mux.HandleFunc("GET /api/v1/internal/platform-config/{key}", controller.InternalRead)
}
