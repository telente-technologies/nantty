package middlewares

import (
	"net/http"

	"nantty/modules/admin/src/types"
	"nantty/platform/httpserver"
)

func AttachClientDetailsToContext(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		next.ServeHTTP(writer, request.WithContext(types.ContextWithClientDetails(request.Context(), types.ClientDetails{
			IpAddress: httpserver.ClientIP(request), UserAgent: request.UserAgent(), RequestId: httpserver.RequestIdFromContext(request.Context()),
		})))
	})
}

func ClientIpAddress(request *http.Request) string {
	return httpserver.ClientIP(request)
}
