package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/retention/controllers"
	"nantty/platform/identityports"
	"nantty/platform/staffauth"
)

func MountRetentionRoutes(mux *http.ServeMux, c *container.Container) {
	controller := controllers.RetentionController{Container: c}
	guard := staffauth.Guard{Registry: identityports.Default}
	mux.Handle("GET /api/v1/admin/retention-policies", guard.RequireStaff("privacy.retention.read", false)(http.HandlerFunc(controller.List)))
	mux.Handle("PUT /api/v1/admin/retention-policies/{category}", guard.RequireStaff("privacy.retention.write", true)(http.HandlerFunc(controller.Update)))
}
