package routes

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/modules/socialSignIn/controllers"
)

func MountSocialSignInRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.SocialSignInController{Container: container}
	mux.HandleFunc("POST /api/v1/auth/google", controller.SignInWithGoogle)
	mux.HandleFunc("POST /api/v1/auth/apple", controller.SignInWithApple)
}
