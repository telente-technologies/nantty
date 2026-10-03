package middlewares

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"zudomart/platform/httpserver"
)

func RequireInternalBearerToken(expected string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			presented, found := strings.CutPrefix(request.Header.Get("Authorization"), "Bearer ")
			if len(expected) < 32 || !found || subtle.ConstantTimeCompare([]byte(presented), []byte(expected)) != 1 {
				httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
				return
			}
			next.ServeHTTP(writer, request)
		})
	}
}
