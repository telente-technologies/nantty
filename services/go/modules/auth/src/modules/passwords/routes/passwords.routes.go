package routes

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/modules/passwords/controllers"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

func MountPasswordsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.PasswordsController{Container: container}
	rateLimitAuth := httpserver.RateLimitAuthEndpoints()
	mux.Handle("POST /api/v1/auth/password/reset", rateLimitAuth(http.HandlerFunc(controller.ResetPassword)))
	mux.Handle("POST /api/v1/auth/password/change", jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)(http.HandlerFunc(controller.ChangePassword)))
}
