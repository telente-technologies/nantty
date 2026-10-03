package middlewares

import (
	"net"
	"net/http"
	"strings"

	"zudomart/modules/admin/src/types"
	"zudomart/platform/httpserver"
)

func AttachClientDetailsToContext(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		next.ServeHTTP(writer, request.WithContext(types.ContextWithClientDetails(request.Context(), types.ClientDetails{
			IpAddress: ClientIpAddress(request), UserAgent: request.UserAgent(), RequestId: httpserver.RequestIdFromContext(request.Context()),
		})))
	})
}

func ClientIpAddress(request *http.Request) string {
	if forwarded := strings.TrimSpace(request.Header.Get("X-Real-Ip")); forwarded != "" {
		return forwarded
	}
	host, _, _ := net.SplitHostPort(request.RemoteAddr)
	return host
}
