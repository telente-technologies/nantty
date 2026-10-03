package routes

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/creatorStatus/controllers"
	"zudomart/platform/jwtauth"
)

func MountCreatorStatusRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.CreatorStatusController{Container: container}
	mux.Handle("POST /api/v1/users/me/creator-application", jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)(http.HandlerFunc(controller.ApplyForCreator)))
}
