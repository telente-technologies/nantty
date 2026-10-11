package middlewares

import (
	"net/http"
	"strings"

	"zudomart/modules/moderation/src/integrations"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

type StaffTokenVerifiers struct {
	Access *jwtauth.AccessTokenVerifier
	StepUp *jwtauth.AccessTokenVerifier
}

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

func RequireStaffWithAnyPermission(verifiers StaffTokenVerifiers, permissions []string, requireStepUp bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			principal, err := verifiers.Access.VerifyAccessTokenAndExtractPrincipal(request.Context(), jwtauth.ExtractBearerTokenFromAuthorizationHeader(request))
			if err != nil {
				httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
				return
			}
			staff := staffFromPrincipal(principal)
			ctx := request.Context()
			if stepUpToken := strings.TrimSpace(request.Header.Get(staffauth.StepUpHeader)); requireStepUp || stepUpToken != "" {
				stepUp, err := verifiers.StepUp.VerifyAccessTokenAndExtractPrincipal(request.Context(), stepUpToken)
				if err == nil && stepUp.UserId == staff.Id && stepUp.SessionId == staff.SessionId {
					staff.SteppedUp = true
					ctx = integrations.ContextWithStepUpToken(ctx, stepUpToken)
				} else if requireStepUp {
					httpserver.WriteJsonResponse(writer, http.StatusForbidden, httpserver.NewApiError(http.StatusForbidden, "STEP_UP_REQUIRED", "Confirm your identity again to continue."))
					return
				}
			}
			if len(permissions) == 0 || !staff.CanAny(permissions...) {
				httpserver.WriteJsonResponse(writer, http.StatusForbidden, httpserver.ErrForbidden)
				return
			}
			next.ServeHTTP(writer, request.WithContext(staffauth.ContextWithStaff(ctx, staff)))
		})
	}
}
