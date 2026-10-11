package middlewares

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/platform/httpserver"
	"zudomart/platform/idempotency"
	"zudomart/platform/jwtauth"
)

func Authenticated(deployed *container.Container) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		return jwtauth.RequireVerifiedAccessToken(deployed.AccessVerifier)(handler)
	}
}

func Idempotent(deployed *container.Container) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		return jwtauth.RequireVerifiedAccessToken(deployed.AccessVerifier)(requireIdempotencyKey(deployed, handler))
	}
}

func requireIdempotencyKey(deployed *container.Container, handler http.HandlerFunc) http.Handler {
	if deployed.IdempotencyStore != nil || deployed.Settings.IsProduction() {
		return idempotency.RequireIdempotencyKeyAndReplayCompletedResponses(deployed.IdempotencyStore, idempotency.MoneyMovingTimeToLive, deployed.Logger)(handler)
	}
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if !idempotency.IsValidIdempotencyKey(request.Header.Get("Idempotency-Key")) {
			httpserver.WriteJsonResponse(writer, http.StatusBadRequest, httpserver.NewApiError(http.StatusBadRequest, "IDEMPOTENCY_KEY_REQUIRED", "Send an Idempotency-Key header of 8-128 letters, digits, - or _."))
			return
		}
		handler(writer, request)
	})
}

func OptionallyIdempotent(deployed *container.Container) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		return jwtauth.RequireVerifiedAccessToken(deployed.AccessVerifier)(idempotency.ReplayWhenIdempotencyKeyPresent(deployed.IdempotencyStore, idempotency.DefaultTimeToLive, deployed.Logger)(handler))
	}
}
