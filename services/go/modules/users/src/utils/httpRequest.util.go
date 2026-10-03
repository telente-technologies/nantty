package utils

import (
	"net"
	"net/http"
	"strings"

	"zudomart/modules/users/src/types"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

func AccountIdFromRequest(request *http.Request) string {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	return principal.UserId
}

func ReadClientIpAddress(request *http.Request) string {
	ipAddress := strings.TrimSpace(request.Header.Get("X-Real-Ip"))
	if ipAddress == "" {
		ipAddress, _, _ = net.SplitHostPort(request.RemoteAddr)
	}
	return ipAddress
}

func StaffActorFromRequest(request *http.Request) types.StaffActor {
	staff, _ := staffauth.StaffFromContext(request.Context())
	return types.StaffActor{
		Id: staff.Id, Name: staff.Name, StepUp: staff.SteppedUp, Role: staff.Role, IpAddress: ReadClientIpAddress(request), UserAgent: request.UserAgent(),
		RequestId: httpserver.RequestIdFromContext(request.Context()),
	}
}
