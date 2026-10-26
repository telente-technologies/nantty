package utils

import (
	"net/http"
	"regexp"
	"slices"
	"strconv"

	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func IsUuid(value string) bool { return uuidPattern.MatchString(value) }

func DecodeAndValidateJsonBody[Request any](writer http.ResponseWriter, request *http.Request, validate func(Request) error) (Request, error) {
	var body Request
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		return body, err
	}
	return body, validate(body)
}

func RequirePrincipal(request *http.Request) (jwtauth.Principal, error) {
	principal, found := jwtauth.PrincipalFromContext(request.Context())
	if !found || principal.UserId == "" {
		return jwtauth.Principal{}, httpserver.ErrUnauthorized
	}
	return principal, nil
}

func RequireAnyRole(request *http.Request, roles ...string) (jwtauth.Principal, error) {
	principal, err := RequirePrincipal(request)
	if err != nil {
		return principal, err
	}
	for _, role := range roles {
		if slices.Contains(principal.Roles, role) {
			return principal, nil
		}
	}
	return jwtauth.Principal{}, httpserver.ErrForbidden
}

func WriteIdempotentJsonResponse(writer http.ResponseWriter, status int, body any, replayed bool) {
	if replayed {
		writer.Header().Set("Idempotent-Replayed", "true")
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func ReadPageLimit(request *http.Request) int {
	limit, err := strconv.Atoi(request.URL.Query().Get("limit"))
	if err != nil || limit < 1 || limit > 100 {
		return 20
	}
	return limit
}

type IssueCollector struct {
	Issues []httpserver.ValidationIssue
}

func (collector *IssueCollector) Add(path, message string) {
	collector.Issues = append(collector.Issues, httpserver.ValidationIssue{Path: path, Message: message})
}

func (collector *IssueCollector) RequireLength(path, value string, minimum, maximum int) {
	if len(value) < minimum || len(value) > maximum {
		collector.Add(path, "has an invalid length")
	}
}

func (collector *IssueCollector) RequireUuid(path, value string) {
	if !IsUuid(value) {
		collector.Add(path, "must be a UUID")
	}
}

func (collector *IssueCollector) RequireRange(path string, value, minimum, maximum int64) {
	if value < minimum || value > maximum {
		collector.Add(path, "is out of range")
	}
}

func (collector *IssueCollector) RequireOneOf(path, value string, allowed ...string) {
	if !slices.Contains(allowed, value) {
		collector.Add(path, "is not an allowed value")
	}
}

func (collector *IssueCollector) Result() error {
	if len(collector.Issues) == 0 {
		return nil
	}
	return httpserver.NewValidationFailedError(collector.Issues)
}

func ReadOptionalPrincipalUserId(request *http.Request, verifier *jwtauth.AccessTokenVerifier) string {
	if principal, found := jwtauth.PrincipalFromContext(request.Context()); found {
		return principal.UserId
	}
	rawToken := jwtauth.ExtractBearerTokenFromAuthorizationHeader(request)
	if rawToken == "" || verifier == nil {
		return ""
	}
	principal, err := verifier.VerifyAccessTokenAndExtractPrincipal(request.Context(), rawToken)
	if err != nil {
		return ""
	}
	return principal.UserId
}
