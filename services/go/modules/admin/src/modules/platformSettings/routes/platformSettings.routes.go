package routes

import (
	"net/http"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/modules/platformSettings/controllers"
)

func MountPlatformSettingsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.PlatformSettingsController{Container: container}
	requireRead := container.Guard.RequireStaff("admin.config.read", false)
	requireWrite := container.Guard.RequireStaff("admin.config.write", true)
	mux.Handle("GET /api/v1/admin/config", requireRead(http.HandlerFunc(controller.List)))
	mux.Handle("GET /api/v1/admin/config/{key}", requireRead(http.HandlerFunc(controller.Get)))
	mux.Handle("PUT /api/v1/admin/config/{key}", requireWrite(http.HandlerFunc(controller.Update)))
	mux.HandleFunc("GET /api/v1/platform-config/creator-requirements", controller.PublicCreatorRequirements)
	mux.HandleFunc("GET /api/v1/internal/platform-config/{key}", controller.InternalRead)
}
