package utils

import (
	"net/http"
	"regexp"
	"strings"

	"zudomart/modules/auth/src/types"
	"zudomart/platform/httpserver"
)

var acceptableDeviceIdPattern = regexp.MustCompile(`^[A-Za-z0-9._:-]{8,128}$`)

func ReadClientDetails(request *http.Request) types.ClientDetails {
	return types.ClientDetails{UserAgent: request.UserAgent(), IpAddress: httpserver.ClientIP(request), DeviceId: NormalizeDeviceId(request.Header.Get("X-Device-Id"))}
}

func NormalizeDeviceId(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if !acceptableDeviceIdPattern.MatchString(trimmed) {
		return ""
	}
	return trimmed
}
