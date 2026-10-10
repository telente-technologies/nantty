package utils

import (
	"net/http"
	"strings"

	"zudomart/modules/auth/src/types"
	"zudomart/platform/httpserver"
)

func ReadClientDetails(request *http.Request) types.ClientDetails {
	return types.ClientDetails{UserAgent: request.UserAgent(), IpAddress: httpserver.ClientIP(request), DeviceId: TruncateToLength(strings.TrimSpace(request.Header.Get("X-Device-Id")), 128)}
}
