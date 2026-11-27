package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/creatorStatus/controllers"
	"nantty/platform/jwtauth"
)

func MountCreatorStatusRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.CreatorStatusController{Container: container}
	requireAdult := jwtauth.RequireAdultAccount()
	mux.Handle("POST /api/v1/users/me/creator-application", jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)(requireAdult(http.HandlerFunc(controller.ApplyForCreator))))
}
