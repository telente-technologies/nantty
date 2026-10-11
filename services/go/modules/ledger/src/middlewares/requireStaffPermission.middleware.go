package middlewares

import (
	"net/http"
	"strings"

	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

const staffPermissionClaimPrefix = "perm:"

type StaffTokenVerifiers struct {
	Access    *jwtauth.AccessTokenVerifier
	StepUp    *jwtauth.AccessTokenVerifier
	SingleUse StepUpConsumer
}

func RequireStaffPermission(verifiers StaffTokenVerifiers, permission string, requireStepUp bool) func(http.Handler) http.Handler {
	if permission == "" {
		return requireStaffWhere(verifiers, func(staffauth.Staff) bool { return true }, requireStepUp)
	}
	return RequireStaffWithAnyPermission(verifiers, []string{permission}, requireStepUp)
}

func RequireStaffWithAnyPermission(verifiers StaffTokenVerifiers, permissions []string, requireStepUp bool) func(http.Handler) http.Handler {
	return requireStaffWhere(verifiers, func(staff staffauth.Staff) bool { return staff.CanAny(permissions...) }, requireStepUp)
}

func requireStaffWhere(verifiers StaffTokenVerifiers, permitted func(staffauth.Staff) bool, requireStepUp bool) func(http.Handler) http.Handler {
	return requireStaffWithStepUpPolicy(verifiers, permitted, requireStepUp, false)
}

func requireStaffWithStepUpPolicy(verifiers StaffTokenVerifiers, permitted func(staffauth.Staff) bool, requireStepUp, singleUse bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			principal, err := verifiers.Access.VerifyAccessTokenAndExtractPrincipal(request.Context(), jwtauth.ExtractBearerTokenFromAuthorizationHeader(request))
			if err != nil {
				httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
				return
			}
			staff := convertPrincipalToStaff(principal)
			if !permitted(staff) {
				httpserver.WriteJsonResponse(writer, http.StatusForbidden, httpserver.ErrForbidden)
				return
			}
			if requireStepUp {
				stepUp, err := verifiers.StepUp.VerifyAccessTokenAndExtractPrincipal(request.Context(), strings.TrimSpace(request.Header.Get(staffauth.StepUpHeader)))
				if err != nil || stepUp.UserId != staff.Id || stepUp.SessionId != staff.SessionId {
					httpserver.WriteJsonResponse(writer, http.StatusForbidden, httpserver.NewApiError(http.StatusForbidden, "STEP_UP_REQUIRED", "Confirm your identity again to continue."))
					return
				}
				staff.SteppedUp = true
				if singleUse {
					if failure := consumeStepUp(request, verifiers.SingleUse, staff.Id); failure != nil {
						httpserver.WriteJsonResponse(writer, failure.Status, failure)
						return
					}
				}
			}
			next.ServeHTTP(writer, request.WithContext(staffauth.ContextWithStaff(request.Context(), staff)))
		})
	}
}

func convertPrincipalToStaff(principal jwtauth.Principal) staffauth.Staff {
	staff := staffauth.Staff{Id: principal.UserId, SessionId: principal.SessionId}
	for _, role := range principal.Roles {
		if permission, isPermission := strings.CutPrefix(role, staffPermissionClaimPrefix); isPermission {
			staff.Permissions = append(staff.Permissions, permission)
		} else if name, isName := strings.CutPrefix(role, "name:"); isName {
			staff.Name = name
		} else {
			staff.Role = role
		}
	}
	return staff
}

func RequireUserAccessToken(verifier *jwtauth.AccessTokenVerifier) func(http.Handler) http.Handler {
	return jwtauth.RequireVerifiedAccessToken(verifier)
}

func RequireUserAccessTokenAndStepUp(verifier *jwtauth.AccessTokenVerifier) func(http.Handler) http.Handler {
	access, stepUp := jwtauth.RequireVerifiedAccessToken(verifier), jwtauth.RequireUserStepUp(verifier)
	return func(next http.Handler) http.Handler { return access(stepUp(next)) }
}
