package routes

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/creatorProfiles/controllers"
	"zudomart/platform/jwtauth"
)

func MountCreatorProfilesRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.CreatorProfilesController{Container: container}
	mux.Handle("POST /api/v1/users/me/creator-profile", jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)(http.HandlerFunc(controller.CreateCreatorProfile)))
}
