package utils

import (
	"net/http"

	"nantty/modules/users/src/types"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
	"nantty/platform/staffauth"
)

func AccountIdFromRequest(request *http.Request) string {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	return principal.UserId
}

func ReadClientIpAddress(request *http.Request) string {
	return httpserver.ClientIP(request)
}

func StaffActorFromRequest(request *http.Request) types.StaffActor {
	staff, _ := staffauth.StaffFromContext(request.Context())
	return types.StaffActor{
		Id: staff.Id, Name: staff.Name, StepUp: staff.SteppedUp, Role: staff.Role, IpAddress: ReadClientIpAddress(request), UserAgent: request.UserAgent(),
		RequestId: httpserver.RequestIdFromContext(request.Context()),
	}
}
