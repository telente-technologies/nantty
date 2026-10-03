package routes

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/modules/passwords/controllers"
	"zudomart/platform/jwtauth"
)

func MountPasswordsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.PasswordsController{Container: container}
	mux.HandleFunc("POST /api/v1/auth/password/reset", controller.ResetPassword)
	mux.Handle("POST /api/v1/auth/password/change", jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)(http.HandlerFunc(controller.ChangePassword)))
}
