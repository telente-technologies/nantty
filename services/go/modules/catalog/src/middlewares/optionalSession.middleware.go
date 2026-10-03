package middlewares

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

func OptionallyAuthenticated(deployed *container.Container) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			rawToken := jwtauth.ExtractBearerTokenFromAuthorizationHeader(request)
			if rawToken == "" {
				handler(writer, request)
				return
			}
			principal, err := deployed.AccessVerifier.VerifyAccessTokenAndExtractPrincipal(request.Context(), rawToken)
			if err != nil {
				httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
				return
			}
			handler(writer, request.WithContext(jwtauth.ContextWithPrincipal(request.Context(), principal)))
		})
	}
}
