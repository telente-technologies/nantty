package routes

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/modules/registration/controllers"
)

func MountRegistrationRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.RegistrationController{Container: container}
	mux.HandleFunc("POST /api/v1/auth/register", controller.RegisterAccount)
	mux.HandleFunc("GET /api/v1/auth/username-available", controller.CheckUsernameAvailability)
}
