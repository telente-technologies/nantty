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
	Access *jwtauth.AccessTokenVerifier
	StepUp *jwtauth.AccessTokenVerifier
}

func RequireStaffPermission(verifiers StaffTokenVerifiers, permission string, requireStepUp bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			principal, err := verifiers.Access.VerifyAccessTokenAndExtractPrincipal(request.Context(), jwtauth.ExtractBearerTokenFromAuthorizationHeader(request))
			if err != nil {
				httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
				return
			}
			staff := convertPrincipalToStaff(principal)
			if permission != "" && !staff.Can(permission) {
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
		} else {
			staff.Role = role
		}
	}
	return staff
}

func RequireUserAccessToken(verifier *jwtauth.AccessTokenVerifier) func(http.Handler) http.Handler {
	return jwtauth.RequireVerifiedAccessToken(verifier)
}
