package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/accountSettings/controllers"
	"nantty/platform/jwtauth"
)

func MountAccountSettingsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.AccountSettingsController{Container: container}
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	mux.Handle("GET /api/v1/users/me/settings", requireAccessToken(http.HandlerFunc(controller.GetMySettings)))
	mux.Handle("PATCH /api/v1/users/me/settings", requireAccessToken(http.HandlerFunc(controller.UpdateMySettings)))
	mux.Handle("GET /api/v1/users/me/marketing-preferences", requireAccessToken(http.HandlerFunc(controller.GetMarketingPreferences)))
	mux.Handle("PUT /api/v1/users/me/marketing-preferences", requireAccessToken(http.HandlerFunc(controller.UpdateMarketingPreferences)))
}
