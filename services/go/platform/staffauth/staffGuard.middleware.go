package staffauth

import (
	"context"
	"net/http"
	"slices"
	"strings"

	"zudomart/platform/httpserver"
	"zudomart/platform/identityports"
	"zudomart/platform/jwtauth"
)

const (
	AccessAudience   = "zudomart-admin"
	StepUpAudience   = "zudomart-admin-step-up"
	StepUpHeader     = "X-Step-Up-Token"
	SuperadminRole   = "superadmin"
	AdminRole        = "admin"
	permissionPrefix = "perm:"
	namePrefix       = "name:"
)

type Staff struct {
	Id          string
	Name        string
	SessionId   string
	Role        string
	Permissions []string
	SteppedUp   bool
}

type staffContextKey struct{}

func StaffFromContext(ctx context.Context) (Staff, bool) {
	staff, found := ctx.Value(staffContextKey{}).(Staff)
	return staff, found
}

func ContextWithStaff(ctx context.Context, staff Staff) context.Context {
	return context.WithValue(ctx, staffContextKey{}, staff)
}

func (staff Staff) Can(permission string) bool {
	return staff.Role == SuperadminRole || slices.Contains(staff.Permissions, permission)
}

func (staff Staff) CanAny(permissions ...string) bool {
	for _, permission := range permissions {
		if staff.Can(permission) {
			return true
		}
	}
	return false
}

func RolesClaimForNamedStaff(name, role string, permissions []string) []string {
	claim := []string{namePrefix + name}
	return append(claim, RolesClaimForStaff(role, permissions)...)
}

func RolesClaimForStaff(role string, permissions []string) []string {
	claim := []string{role}
	for _, permission := range permissions {
		claim = append(claim, permissionPrefix+permission)
	}
	return claim
}

func staffFromPrincipal(principal jwtauth.Principal) Staff {
	staff := Staff{Id: principal.UserId, SessionId: principal.SessionId}
	for _, role := range principal.Roles {
		if permission, isPermission := strings.CutPrefix(role, permissionPrefix); isPermission {
			staff.Permissions = append(staff.Permissions, permission)
		} else if name, isName := strings.CutPrefix(role, namePrefix); isName {
			staff.Name = name
		} else {
			staff.Role = role
		}
	}
	return staff
}

type Guard struct {
	Registry *identityports.Registry
}

func (guard Guard) RequireStaff(permission string, requireStepUp bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			staff, failure := guard.authenticate(request, requireStepUp)
			if failure != nil {
				httpserver.WriteJsonResponse(writer, failure.Status, failure)
				return
			}
			if permission != "" && !staff.Can(permission) {
				httpserver.WriteJsonResponse(writer, http.StatusForbidden, httpserver.ErrForbidden)
				return
			}
			next.ServeHTTP(writer, request.WithContext(ContextWithStaff(request.Context(), staff)))
		})
	}
}

func (guard Guard) RequireStaffWithAnyPermission(permissions []string, requireStepUp bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			staff, failure := guard.authenticate(request, requireStepUp)
			if failure != nil {
				httpserver.WriteJsonResponse(writer, failure.Status, failure)
				return
			}
			if !staff.CanAny(permissions...) {
				httpserver.WriteJsonResponse(writer, http.StatusForbidden, httpserver.ErrForbidden)
				return
			}
			next.ServeHTTP(writer, request.WithContext(ContextWithStaff(request.Context(), staff)))
		})
	}
}

func (guard Guard) authenticate(request *http.Request, requireStepUp bool) (Staff, *httpserver.ApiError) {
	tokens, err := guard.Registry.StaffTokenService()
	if err != nil {
		return Staff{}, httpserver.NewApiError(http.StatusServiceUnavailable, "UNAVAILABLE", "Staff authentication is unavailable.")
	}
	accessVerifier := jwtauth.NewAccessTokenVerifierFromKeySetProvider(tokens.PublishedKeySet, tokens.StaffTokenIssuer(), AccessAudience)
	principal, err := accessVerifier.VerifyAccessTokenAndExtractPrincipal(request.Context(), jwtauth.ExtractBearerTokenFromAuthorizationHeader(request))
	if err != nil {
		return Staff{}, httpserver.ErrUnauthorized
	}
	staff := staffFromPrincipal(principal)
	if checker, checkerErr := guard.Registry.StaffSessionChecker(); checkerErr == nil {
		if active, err := checker.IsStaffSessionActive(request.Context(), staff.Id, staff.SessionId); err != nil || !active {
			return Staff{}, httpserver.ErrUnauthorized
		}
	}
	if !requireStepUp {
		return staff, nil
	}
	stepUpVerifier := jwtauth.NewAccessTokenVerifierFromKeySetProvider(tokens.PublishedKeySet, tokens.StaffTokenIssuer(), StepUpAudience)
	stepUp, err := stepUpVerifier.VerifyAccessTokenAndExtractPrincipal(request.Context(), strings.TrimSpace(request.Header.Get(StepUpHeader)))
	if err != nil || stepUp.UserId != staff.Id || stepUp.SessionId != staff.SessionId {
		return Staff{}, httpserver.NewApiError(http.StatusForbidden, "STEP_UP_REQUIRED", "Confirm your identity again to continue.")
	}
	staff.SteppedUp = true
	return staff, nil
}
