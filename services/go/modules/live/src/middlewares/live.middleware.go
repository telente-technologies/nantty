package middlewares

import (
	"crypto/subtle"
	"net/http"
	"slices"
	"strings"

	"zudomart/modules/live/src/container"
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

func Admin(deployed *container.Container) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		return jwtauth.RequireVerifiedAccessToken(deployed.AccessVerifier)(requireAdminRole(handler))
	}
}

func requireIdempotencyKey(deployed *container.Container, handler http.HandlerFunc) http.Handler {
	if deployed.IdempotencyStore != nil {
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

func requireAdminRole(handler http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		principal, _ := jwtauth.PrincipalFromContext(request.Context())
		if !slices.Contains(principal.Roles, "admin") {
			httpserver.WriteJsonResponse(writer, http.StatusForbidden, httpserver.ErrForbidden)
			return
		}
		handler(writer, request)
	})
}

func InternalToken(deployed *container.Container) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			expected := deployed.Settings.InternalApiToken
			presented := request.Header.Get("X-Internal-Token")
			if presented == "" {
				presented = strings.TrimPrefix(request.Header.Get("Authorization"), "Bearer ")
			}
			if expected == "" || subtle.ConstantTimeCompare([]byte(presented), []byte(expected)) != 1 {
				httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
				return
			}
			handler(writer, request)
		})
	}
}
