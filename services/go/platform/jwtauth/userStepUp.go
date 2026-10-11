package jwtauth

import (
	"context"
	"net/http"
	"strings"

	"zudomart/platform/httpserver"
)

const (
	UserStepUpAudience = "zudomart-user-step-up"
	UserStepUpHeader   = "X-Step-Up-Token"
)

func (verifier *AccessTokenVerifier) WithAudience(audience string) *AccessTokenVerifier {
	copied := *verifier
	copied.audience = audience
	return &copied
}

func VerifyUserStepUp(ctx context.Context, accessVerifier *AccessTokenVerifier, request *http.Request, principal Principal) bool {
	raw := strings.TrimSpace(request.Header.Get(UserStepUpHeader))
	if raw == "" || accessVerifier == nil {
		return false
	}
	stepUp, err := accessVerifier.WithAudience(UserStepUpAudience).VerifyAccessTokenAndExtractPrincipal(ctx, raw)
	return err == nil && stepUp.UserId == principal.UserId && stepUp.SessionId == principal.SessionId
}

var ErrUserStepUpRequired = httpserver.NewApiError(http.StatusForbidden, "STEP_UP_REQUIRED", "Confirm it's you again to continue.")

func RequireUserStepUp(accessVerifier *AccessTokenVerifier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			principal, found := PrincipalFromContext(request.Context())
			if !found || !VerifyUserStepUp(request.Context(), accessVerifier, request, principal) {
				httpserver.WriteJsonResponse(writer, http.StatusForbidden, ErrUserStepUpRequired)
				return
			}
			next.ServeHTTP(writer, request)
		})
	}
}
