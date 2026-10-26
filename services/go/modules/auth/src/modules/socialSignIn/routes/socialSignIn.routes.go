package routes

import (
	"net/http"

	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/modules/socialSignIn/controllers"
	"nantty/platform/httpserver"
)

func MountSocialSignInRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.SocialSignInController{Container: container}
	rateLimitAuth := httpserver.RateLimitAuthEndpoints()
	mux.Handle("POST /api/v1/auth/google", rateLimitAuth(http.HandlerFunc(controller.SignInWithGoogle)))
	mux.Handle("POST /api/v1/auth/apple", rateLimitAuth(http.HandlerFunc(controller.SignInWithApple)))
}
