package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/profiles/controllers"
	"nantty/platform/jwtauth"
)

func MountProfilesRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.ProfilesController{Container: container}
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	mux.Handle("GET /api/v1/users/me", requireAccessToken(http.HandlerFunc(controller.GetMyProfile)))
	mux.Handle("PATCH /api/v1/users/me", requireAccessToken(http.HandlerFunc(controller.UpdateMyProfile)))
	mux.Handle("POST /api/v1/users/me/media/upload-intents", requireAccessToken(http.HandlerFunc(controller.CreateUploadIntent)))
	mux.Handle("PATCH /api/v1/users/me/preferences", requireAccessToken(http.HandlerFunc(controller.UpdateCountryPreference)))
	mux.Handle("POST /api/v1/users/me/deactivate", requireAccessToken(http.HandlerFunc(controller.DeactivateAccount)))
	mux.Handle("GET /api/v1/users/username/{username}", requireAccessToken(http.HandlerFunc(controller.GetUserProfileByUsername)))
	mux.HandleFunc("GET /api/v1/users/by-username/{username}", controller.GetUserProfileByUsername)
	mux.HandleFunc("GET /api/v1/users/{userId}", controller.GetUserProfile)
}
