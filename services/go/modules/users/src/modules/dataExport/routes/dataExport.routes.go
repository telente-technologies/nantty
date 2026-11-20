package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/dataExport/controllers"
	"nantty/platform/jwtauth"
)

func MountDataExportRoutes(mux *http.ServeMux, c *container.Container) {
	controller := controllers.DataExportController{Container: c}
	requireAccount := jwtauth.RequireVerifiedAccessTokenAllowingSuspended(c.AccessVerifier)
	mux.Handle("POST /api/v1/users/me/data-exports", requireAccount(http.HandlerFunc(controller.Request)))
	mux.Handle("GET /api/v1/users/me/data-exports", requireAccount(http.HandlerFunc(controller.List)))
	mux.Handle("GET /api/v1/users/me/data-exports/{exportId}", requireAccount(http.HandlerFunc(controller.Get)))
}
