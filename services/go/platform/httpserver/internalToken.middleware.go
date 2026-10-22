package httpserver

import (
	"crypto/subtle"
	"net/http"
	"strings"
)

func RequireInternalToken(expected string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			presented := request.Header.Get("X-Internal-Token")
			if presented == "" {
				presented = strings.TrimPrefix(request.Header.Get("Authorization"), "Bearer ")
			}
			if expected == "" || subtle.ConstantTimeCompare([]byte(presented), []byte(expected)) != 1 {
				WriteJsonResponse(writer, http.StatusUnauthorized, ErrUnauthorized)
				return
			}
			next.ServeHTTP(writer, request)
		})
	}
}
