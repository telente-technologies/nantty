package routes

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/topics/controllers"
	"zudomart/platform/jwtauth"
)

func MountTopicsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.TopicsController{Container: container}
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	mux.HandleFunc("GET /api/v1/topics", controller.ListTopics)
	mux.Handle("GET /api/v1/users/me/topics", requireAccessToken(http.HandlerFunc(controller.ListMyTopics)))
	mux.Handle("PUT /api/v1/users/me/topics", requireAccessToken(http.HandlerFunc(controller.SaveMyTopics)))
}
