package jwtauth

import (
	"context"
	"net/http"
	"slices"
	"strings"

	"zudomart/platform/httpserver"
)

type principalContextKey struct{}

func PrincipalFromContext(ctx context.Context) (Principal, bool) {
	principal, found := ctx.Value(principalContextKey{}).(Principal)
	return principal, found
}

func ContextWithPrincipal(ctx context.Context, principal Principal) context.Context {
	return context.WithValue(ctx, principalContextKey{}, principal)
}

func ExtractBearerTokenFromAuthorizationHeader(request *http.Request) string {
	header := request.Header.Get("Authorization")
	if len(header) < 8 || !strings.EqualFold(header[:7], "Bearer ") {
		return ""
	}
	return strings.TrimSpace(header[7:])
}

func RequireVerifiedAccessToken(verifier *AccessTokenVerifier) func(http.Handler) http.Handler {
	return RequireVerifiedAccessTokenWithSuspendedPolicy(verifier, false)
}

func RequireVerifiedAccessTokenAllowingSuspended(verifier *AccessTokenVerifier) func(http.Handler) http.Handler {
	return RequireVerifiedAccessTokenWithSuspendedPolicy(verifier, true)
}

func RequireVerifiedAccessTokenWithSuspendedPolicy(verifier *AccessTokenVerifier, allowSuspended bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			rawToken := ExtractBearerTokenFromAuthorizationHeader(request)
			if rawToken == "" {
				httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
				return
			}
			principal, err := verifier.VerifyAccessTokenAndExtractPrincipal(request.Context(), rawToken)
			if err != nil {
				httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
				return
			}
			if !allowSuspended && slices.Contains(principal.Roles, "suspended") {
				httpserver.WriteJsonResponse(writer, http.StatusForbidden, httpserver.NewForbiddenError("account is suspended"))
				return
			}
			next.ServeHTTP(writer, request.WithContext(ContextWithPrincipal(request.Context(), principal)))
		})
	}
}
