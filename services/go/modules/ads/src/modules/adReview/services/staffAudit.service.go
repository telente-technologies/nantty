package services

import (
	"net/http"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/platform/jwtauth"
	"nantty/platform/staffaudit"
	"nantty/platform/staffauth"
)

func staffFromRequest(request *http.Request) staffauth.Staff {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	staff := staffauth.Staff{Id: principal.UserId, SessionId: principal.SessionId, Name: "Staff"}
	for _, role := range principal.Roles {
		switch {
		case len(role) > 5 && role[:5] == "perm:":
			staff.Permissions = append(staff.Permissions, role[5:])
		case len(role) > 5 && role[:5] == "name:":
			staff.Name = role[5:]
		default:
			staff.Role = role
		}
	}
	return staff
}

func RecordStaffAction(request *http.Request, deployed *container.Container, action, subjectType, subjectId, reason string, before, after any) error {
	if deployed.Audit == nil {
		return nil
	}
	if err := staffaudit.RecordStaffChange(request, deployed.Audit, staffFromRequest(request), action, subjectType, subjectId, reason, before, after); err != nil {
		deployed.Logger.Warn("staff audit failed", "action", action, "error", err)
		return adserrors.AuditUnavailable
	}
	return nil
}
