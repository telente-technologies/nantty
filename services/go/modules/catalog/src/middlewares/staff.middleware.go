package middlewares

import (
	"net/http"
	"strings"

	"zudomart/modules/catalog/src/container"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

var errStepUpRequired = httpserver.NewApiError(http.StatusForbidden, "STEP_UP_REQUIRED", "Confirm your identity again to continue.")

func staffFromPrincipal(principal jwtauth.Principal) staffauth.Staff {
	staff := staffauth.Staff{Id: principal.UserId, SessionId: principal.SessionId}
	for _, role := range principal.Roles {
		if permission, isPermission := strings.CutPrefix(role, "perm:"); isPermission {
			staff.Permissions = append(staff.Permissions, permission)
		} else if name, isName := strings.CutPrefix(role, "name:"); isName {
			staff.Name = name
		} else {
			staff.Role = role
		}
	}
	return staff
}

func StaffWithAnyPermission(deployed *container.Container, permissions []string, requireStepUp bool) func(http.HandlerFunc) http.Handler {
	return func(handler http.HandlerFunc) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			verifiers := deployed.Staff
			if verifiers.Access == nil {
				httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
				return
			}
			principal, err := verifiers.Access.VerifyAccessTokenAndExtractPrincipal(request.Context(), jwtauth.ExtractBearerTokenFromAuthorizationHeader(request))
			if err != nil {
				httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
				return
			}
			staff := staffFromPrincipal(principal)
			if token := strings.TrimSpace(request.Header.Get(staffauth.StepUpHeader)); verifiers.StepUp != nil && token != "" {
				stepUp, err := verifiers.StepUp.VerifyAccessTokenAndExtractPrincipal(request.Context(), token)
				staff.SteppedUp = err == nil && stepUp.UserId == staff.Id && stepUp.SessionId == staff.SessionId
			}
			if !staff.CanAny(permissions...) {
				httpserver.WriteJsonResponse(writer, http.StatusForbidden, httpserver.ErrForbidden)
				return
			}
			if requireStepUp && !staff.SteppedUp {
				httpserver.WriteJsonResponse(writer, http.StatusForbidden, errStepUpRequired)
				return
			}
			handler(writer, request.WithContext(staffauth.ContextWithStaff(request.Context(), staff)))
		})
	}
}

func Staff(deployed *container.Container, permission string) func(http.HandlerFunc) http.Handler {
	return StaffWithAnyPermission(deployed, []string{permission}, false)
}
