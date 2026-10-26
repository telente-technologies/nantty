package middlewares

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

func WidgetReader(deployed *container.Container) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		return jwtauth.RequireAccessTokenOrWidgetToken(deployed.AccessVerifier)(handler)
	}
}

func WidgetStoreMember(deployed *container.Container, permission string) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		return WidgetReader(deployed)(func(writer http.ResponseWriter, request *http.Request) {
			access, err := resolveStoreAccess(deployed, request, permission)
			if err != nil {
				httpserver.WriteErrorResponse(writer, request, deployed.Logger, err)
				return
			}
			handler(writer, request.WithContext(ContextWithStoreAccess(request.Context(), access)))
		})
	}
}
