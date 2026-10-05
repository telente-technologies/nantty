package middlewares

import (
	"crypto/subtle"
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/platform/httpserver"
)

func InternalToken(deployed *container.Container) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			expected := deployed.Settings.InternalSharedSecret
			if len(expected) < 16 || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
				httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
				return
			}
			handler(writer, request)
		})
	}
}
