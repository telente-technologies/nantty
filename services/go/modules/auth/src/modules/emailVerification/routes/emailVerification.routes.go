package routes

import (
	"net/http"

	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/modules/emailVerification/controllers"
	"nantty/platform/jwtauth"
)

func MountEmailVerificationRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.EmailVerificationController{Container: container}
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	mux.Handle("POST /api/v1/users/me/email/verification", requireAccessToken(http.HandlerFunc(controller.SendCode)))
	mux.Handle("POST /api/v1/users/me/email/verification/confirm", requireAccessToken(http.HandlerFunc(controller.Confirm)))
}
