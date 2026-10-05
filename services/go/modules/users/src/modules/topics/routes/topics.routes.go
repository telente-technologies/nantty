package routes

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/topics/controllers"
	"zudomart/platform/identityports"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

func MountTopicsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.TopicsController{Container: container}
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	mux.HandleFunc("GET /api/v1/topics", controller.ListTopics)
	mux.Handle("GET /api/v1/users/me/topics", requireAccessToken(http.HandlerFunc(controller.ListMyTopics)))
	mux.Handle("PUT /api/v1/users/me/topics", requireAccessToken(http.HandlerFunc(controller.SaveMyTopics)))
	manage := func(handler http.HandlerFunc) http.Handler {
		return staffauth.Guard{Registry: identityports.Default}.RequireStaff("catalog:manage", false)(handler)
	}
	mux.Handle("GET /api/v1/admin/catalog/topics", manage(controller.AdminList))
	mux.Handle("POST /api/v1/admin/catalog/topics", manage(controller.AdminCreate))
	mux.Handle("GET /api/v1/admin/catalog/topics/{topicId}", manage(controller.AdminGet))
	mux.Handle("PATCH /api/v1/admin/catalog/topics/{topicId}", manage(controller.AdminUpdate))
}
