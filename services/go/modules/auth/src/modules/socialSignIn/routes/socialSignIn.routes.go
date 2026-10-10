package routes

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/modules/socialSignIn/controllers"
	"zudomart/platform/httpserver"
)

func MountSocialSignInRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.SocialSignInController{Container: container}
	rateLimitAuth := httpserver.RateLimitAuthEndpoints()
	mux.Handle("POST /api/v1/auth/google", rateLimitAuth(http.HandlerFunc(controller.SignInWithGoogle)))
	mux.Handle("POST /api/v1/auth/apple", rateLimitAuth(http.HandlerFunc(controller.SignInWithApple)))
}
