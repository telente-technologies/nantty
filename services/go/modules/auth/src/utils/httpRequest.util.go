package utils

import (
	"net"
	"net/http"
	"strings"

	"zudomart/modules/auth/src/types"
)

func ReadClientDetails(request *http.Request) types.ClientDetails {
	ipAddress := strings.TrimSpace(request.Header.Get("X-Real-Ip"))
	if ipAddress == "" {
		ipAddress, _, _ = net.SplitHostPort(request.RemoteAddr)
	}
	return types.ClientDetails{UserAgent: request.UserAgent(), IpAddress: ipAddress}
}
