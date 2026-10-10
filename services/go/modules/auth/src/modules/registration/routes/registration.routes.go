package routes

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/modules/registration/controllers"
	"zudomart/platform/httpserver"
)

func MountRegistrationRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.RegistrationController{Container: container}
	rateLimitAuth := httpserver.RateLimitAuthEndpoints()
	mux.Handle("POST /api/v1/auth/register", rateLimitAuth(http.HandlerFunc(controller.RegisterAccount)))
	mux.Handle("GET /api/v1/auth/username-available", rateLimitAuth(http.HandlerFunc(controller.CheckUsernameAvailability)))
}
