package routes

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/modules/registration/controllers"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

func MountRegistrationRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.RegistrationController{Container: container}
	rateLimitAuth := httpserver.RateLimitAuthEndpoints()
	mux.Handle("POST /api/v1/auth/register", rateLimitAuth(http.HandlerFunc(controller.RegisterAccount)))
	mux.Handle("PUT /api/v1/auth/account/birthday", rateLimitAuth(jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)(http.HandlerFunc(controller.AddAccountBirthday))))
	mux.Handle("GET /api/v1/auth/username-available", rateLimitAuth(jwtauth.OptionalVerifiedAccessToken(container.AccessVerifier)(http.HandlerFunc(controller.CheckUsernameAvailability))))
}
