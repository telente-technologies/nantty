package middlewares

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
	"nantty/platform/staffauth"
)

const singleUseStepUpRetention = 15 * time.Minute

var (
	ErrStepUpReused            = httpserver.NewApiError(http.StatusUnauthorized, "STEP_UP_REUSED", "This confirmation was already used. Confirm it's you again for each money action.")
	ErrStepUpLedgerUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "STEP_UP_UNAVAILABLE", "We couldn't confirm this action right now. Try again in a moment.")
)

type StepUpConsumer interface {
	ConsumeStepUp(ctx context.Context, tokenHash, staffId, route string, expiresAt time.Time) (bool, error)
}

func RequireStaffPermissionWithSingleUseStepUp(verifiers StaffTokenVerifiers, permission string) func(http.Handler) http.Handler {
	return requireStaffWithStepUpPolicy(verifiers, func(staff staffauth.Staff) bool { return permission == "" || staff.Can(permission) }, true, true)
}

func RequireStaffWithAnyPermissionAndSingleUseStepUp(verifiers StaffTokenVerifiers, permissions []string) func(http.Handler) http.Handler {
	return requireStaffWithStepUpPolicy(verifiers, func(staff staffauth.Staff) bool { return staff.CanAny(permissions...) }, true, true)
}

func consumeStepUp(request *http.Request, consumer StepUpConsumer, staffId string) *httpserver.ApiError {
	if consumer == nil {
		return ErrStepUpLedgerUnavailable
	}
	return consumeStepUpDigest(request, consumer, StepUpTokenDigest(request.Header.Get(staffauth.StepUpHeader)), staffId)
}

const StepUpTokenDigestHeader = "X-Step-Up-Token-Digest"

func StepUpTokenDigest(token string) string {
	digest := sha256.Sum256([]byte(strings.TrimSpace(token)))
	return hex.EncodeToString(digest[:])
}

func consumeStepUpDigest(request *http.Request, consumer StepUpConsumer, digest, actorId string) *httpserver.ApiError {
	if consumer == nil {
		return ErrStepUpLedgerUnavailable
	}
	route := request.Method + " " + request.URL.Path
	if len(route) > 200 {
		route = route[:200]
	}
	first, err := consumer.ConsumeStepUp(request.Context(), digest, actorId, route, time.Now().Add(singleUseStepUpRetention))
	if err != nil {
		return ErrStepUpLedgerUnavailable
	}
	if !first {
		return ErrStepUpReused
	}
	return nil
}

func RequireUserAccessTokenAndSingleUseStepUp(verifier *jwtauth.AccessTokenVerifier, consumer StepUpConsumer) func(http.Handler) http.Handler {
	access, stepUp := jwtauth.RequireVerifiedAccessToken(verifier), jwtauth.RequireUserStepUp(verifier)
	consume := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			principal, _ := jwtauth.PrincipalFromContext(request.Context())
			digest := StepUpTokenDigest(request.Header.Get(jwtauth.UserStepUpHeader))
			if failure := consumeStepUpDigest(request, consumer, digest, "user:"+principal.UserId); failure != nil {
				httpserver.WriteJsonResponse(writer, failure.Status, failure)
				return
			}
			next.ServeHTTP(writer, request)
		})
	}
	return func(next http.Handler) http.Handler { return access(stepUp(consume(next))) }
}

func RequireRelayedSingleUseStepUp(consumer StepUpConsumer) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(writer http.ResponseWriter, request *http.Request) {
			digest := strings.TrimSpace(request.Header.Get(StepUpTokenDigestHeader))
			if len(digest) != sha256.Size*2 {
				httpserver.WriteJsonResponse(writer, http.StatusForbidden, jwtauth.ErrUserStepUpRequired)
				return
			}
			if failure := consumeStepUpDigest(request, consumer, digest, "seller:"+request.Header.Get("X-Actor-Id")); failure != nil {
				httpserver.WriteJsonResponse(writer, failure.Status, failure)
				return
			}
			next(writer, request)
		}
	}
}
