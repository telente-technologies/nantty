package routes

import (
	"net/http"

	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/modules/oneTimeCodes/controllers"
	"nantty/platform/httpserver"
)

func MountOneTimeCodesRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.OneTimeCodesController{Container: container}
	rateLimitAuth := httpserver.RateLimitAuthEndpoints()
	mux.Handle("POST /api/v1/auth/otp/send", rateLimitAuth(http.HandlerFunc(controller.SendOneTimeCode)))
	mux.Handle("POST /api/v1/auth/otp/verify", rateLimitAuth(http.HandlerFunc(controller.VerifyOneTimeCode)))
}
