package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/actingProfiles/controllers"
	"nantty/platform/jwtauth"
)

func MountActingProfilesRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.ActingProfilesController{Container: container}
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	mux.Handle("GET /api/v1/users/me/profiles", requireAccessToken(http.HandlerFunc(controller.ListMyProfiles)))
	mux.Handle("GET /api/v1/users/me/acting-profile", requireAccessToken(http.HandlerFunc(controller.GetActingProfile)))
	mux.Handle("PUT /api/v1/users/me/acting-profile", requireAccessToken(http.HandlerFunc(controller.SwitchActingProfile)))
}
