package routes

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/businessProfiles/controllers"
	"zudomart/platform/jwtauth"
)

func MountBusinessProfilesRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.BusinessProfilesController{Container: container}
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	mux.HandleFunc("GET /api/v1/business-categories", controller.ListBusinessCategories)
	mux.Handle("POST /api/v1/users/me/business-profiles", requireAccessToken(http.HandlerFunc(controller.CreateBusinessProfile)))
	mux.Handle("PATCH /api/v1/users/me/business-profiles/{profileId}", requireAccessToken(http.HandlerFunc(controller.UpdateBusinessProfile)))
}
