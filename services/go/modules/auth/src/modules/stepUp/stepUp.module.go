package stepup

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	controller := StepUpController{Container: container}
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	rateLimitAuth := httpserver.RateLimitAuthEndpoints()
	mux.Handle("POST /api/v1/auth/step-up", rateLimitAuth(requireAccessToken(http.HandlerFunc(controller.GrantStepUp))))
}
