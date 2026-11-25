package middlewares

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"nantty/modules/orders/src/container"
	"nantty/platform/httpserver"
)

func RequireInternalToken(deployed *container.Container) func(http.HandlerFunc) http.Handler {
	return func(next http.HandlerFunc) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			presented := request.Header.Get("X-Internal-Token")
			if presented == "" {
				presented = strings.TrimPrefix(request.Header.Get("Authorization"), "Bearer ")
			}
			expected := deployed.Settings.InternalApiToken
			if expected == "" || subtle.ConstantTimeCompare([]byte(presented), []byte(expected)) != 1 {
				httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
				return
			}
			next(writer, request)
		})
	}
}

func RequireBusinessMessagingAuthorizationToken(deployed *container.Container) func(http.HandlerFunc) http.Handler {
	return func(next http.HandlerFunc) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			presented := request.Header.Get("X-Business-Messaging-Authorization-Token")
			expected := deployed.Settings.BusinessMessagingAuthorizationToken
			if expected == "" || subtle.ConstantTimeCompare([]byte(presented), []byte(expected)) != 1 {
				httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
				return
			}
			next(writer, request)
		})
	}
}
