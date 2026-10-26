package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/privacySettings/controllers"
	"nantty/platform/jwtauth"
)

func MountPrivacySettingsRoutes(mux *http.ServeMux, c *container.Container) {
	controller := controllers.PrivacySettingsController{Container: c}
	requireAccount := jwtauth.RequireVerifiedAccessToken(c.AccessVerifier)
	mux.Handle("GET /api/v1/users/me/privacy-settings", requireAccount(http.HandlerFunc(controller.GetMine)))
	mux.Handle("PATCH /api/v1/users/me/privacy-settings", requireAccount(http.HandlerFunc(controller.UpdateMine)))
	mux.HandleFunc("GET /api/v1/internal/users/{accountId}/privacy-settings", controller.GetForInternalCaller)
	mux.HandleFunc("GET /api/v1/internal/ownership/profile/{id}", controller.GetProfileOwnership)
}
