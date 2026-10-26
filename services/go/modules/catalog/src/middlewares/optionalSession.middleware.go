package middlewares

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
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
