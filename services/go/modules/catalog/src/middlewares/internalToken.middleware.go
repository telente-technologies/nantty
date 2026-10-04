package middlewares

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"zudomart/modules/catalog/src/container"
	"zudomart/platform/httpserver"
)

func PresentedInternalToken(request *http.Request) string {
	if token := request.Header.Get("X-Internal-Token"); token != "" {
		return token
	}
	return strings.TrimPrefix(request.Header.Get("Authorization"), "Bearer ")
}

func RequireInternalToken(deployed *container.Container) func(http.HandlerFunc) http.Handler {
	return func(next http.HandlerFunc) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			expected := deployed.Settings.InternalApiToken
			if expected == "" || subtle.ConstantTimeCompare([]byte(PresentedInternalToken(request)), []byte(expected)) != 1 {
				httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
				return
			}
			next(writer, request)
		})
	}
}
