package staffauth

import (
	"context"
	"net/http"
	"slices"
	"strings"

	"nantty/platform/httpserver"
	"nantty/platform/identityports"
	"nantty/platform/jwtauth"
)

const (
	AccessAudience   = "nantty-admin"
	StepUpAudience   = "nantty-admin-step-up"
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
	return guard.requireStaffWhere(func(staff Staff) bool { return permission == "" || staff.Can(permission) }, requireStepUp)
}

func (guard Guard) RequireStaffWithAnyPermission(permissions []string, requireStepUp bool) func(http.Handler) http.Handler {
	return guard.requireStaffWhere(func(staff Staff) bool { return staff.CanAny(permissions...) }, requireStepUp)
}

func (guard Guard) RequireSuperadmin(requireStepUp bool) func(http.Handler) http.Handler {
	return guard.requireStaffWhere(func(staff Staff) bool { return staff.Role == SuperadminRole }, requireStepUp)
}

func (guard Guard) requireStaffWhere(permitted func(Staff) bool, requireStepUp bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			staff, failure := guard.authenticate(request, requireStepUp)
			if failure != nil {
				httpserver.WriteJsonResponse(writer, failure.Status, failure)
				return
			}
			if !permitted(staff) {
				httpserver.WriteJsonResponse(writer, http.StatusForbidden, httpserver.ErrForbidden)
				return
			}
			guard.serveAndAuditUnrecordedMutation(writer, request, staff, next)
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
	checker, checkerErr := guard.Registry.StaffSessionChecker()
	if checkerErr != nil {
		return Staff{}, httpserver.NewApiError(http.StatusServiceUnavailable, "UNAVAILABLE", "Staff authentication is unavailable.")
	}
	if active, err := checker.IsStaffSessionActive(request.Context(), staff.Id, staff.SessionId); err != nil || !active {
		return Staff{}, httpserver.ErrUnauthorized
	}
	if failure := guard.refuseDisallowedNetwork(request, staff); failure != nil {
		return Staff{}, failure
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

func (guard Guard) refuseDisallowedNetwork(request *http.Request, staff Staff) *httpserver.ApiError {
	policy, err := guard.Registry.StaffNetworkPolicy()
	if err != nil {
		return httpserver.NewApiError(http.StatusServiceUnavailable, "UNAVAILABLE", "Staff authentication is unavailable.")
	}
	allowed, err := policy.IsStaffAddressAllowed(request.Context(), staff.Id, ClientAddress(request))
	if err != nil {
		return httpserver.NewApiError(http.StatusServiceUnavailable, "UNAVAILABLE", "Staff authentication is unavailable.")
	}
	if !allowed {
		return IpNotAllowed
	}
	return nil
}

var IpNotAllowed = httpserver.NewApiError(http.StatusForbidden, "IP_NOT_ALLOWED", "The admin console cannot be used from this network.")

func ClientAddress(request *http.Request) string {
	return httpserver.ClientIP(request)
}
