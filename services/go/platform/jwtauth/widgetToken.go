package jwtauth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwt"
	"github.com/redis/go-redis/v9"

	"zudomart/platform/httpserver"
)

const (
	WidgetTokenAudience        = "zudomart-widgets"
	WidgetTokenScope           = "widgets:read"
	WidgetPrincipalScope       = "widgets"
	widgetTokenCurrentPrefix   = "auth:widget-token:"
	widgetTokenRegistryTimeout = 150 * time.Millisecond
)

type WidgetTokenRegistry interface {
	RecordCurrentWidgetToken(ctx context.Context, sessionId, tokenId string, ttl time.Duration) error
	IsWidgetTokenCurrent(ctx context.Context, sessionId, tokenId string) (bool, error)
	ForgetWidgetTokens(ctx context.Context, sessionIds []string) error
}

func RegisteredWidgetTokenRegistry() WidgetTokenRegistry {
	registry, _ := RegisteredSessionDenylist().(WidgetTokenRegistry)
	return registry
}

func (denylist *RedisSessionDenylist) RecordCurrentWidgetToken(ctx context.Context, sessionId, tokenId string, ttl time.Duration) error {
	if ttl <= 0 {
		return errors.New("widget token ttl must be positive")
	}
	return denylist.client.Set(ctx, widgetTokenCurrentPrefix+sessionId, tokenId, ttl).Err()
}

func (denylist *RedisSessionDenylist) IsWidgetTokenCurrent(ctx context.Context, sessionId, tokenId string) (bool, error) {
	current, err := denylist.client.Get(ctx, widgetTokenCurrentPrefix+sessionId).Result()
	if errors.Is(err, redis.Nil) {
		return false, nil
	}
	return err == nil && current == tokenId, err
}

func (denylist *RedisSessionDenylist) ForgetWidgetTokens(ctx context.Context, sessionIds []string) error {
	if len(sessionIds) == 0 {
		return nil
	}
	keys := make([]string, 0, len(sessionIds))
	for _, sessionId := range sessionIds {
		keys = append(keys, widgetTokenCurrentPrefix+sessionId)
	}
	return denylist.client.Del(ctx, keys...).Err()
}

func forgetWidgetTokensForRevokedSessions(ctx context.Context, sessionIds []string) {
	registry := RegisteredWidgetTokenRegistry()
	if registry == nil || len(sessionIds) == 0 {
		return
	}
	if err := registry.ForgetWidgetTokens(ctx, sessionIds); err != nil {
		slog.ErrorContext(ctx, "widget token cleanup failed; the session denylist still blocks them", slog.Any("error", err))
	}
}

func isWidgetTokenStillCurrent(ctx context.Context, registry WidgetTokenRegistry, sessionId, tokenId string) bool {
	if registry == nil {
		return true
	}
	checkCtx, cancel := context.WithTimeout(ctx, widgetTokenRegistryTimeout)
	defer cancel()
	current, err := registry.IsWidgetTokenCurrent(checkCtx, sessionId, tokenId)
	if err != nil {
		slog.ErrorContext(ctx, "widget token registry check failed; rejecting token to fail closed", slog.Any("error", err))
		return false
	}
	return current
}

func (verifier *AccessTokenVerifier) VerifyWidgetTokenAndExtractPrincipal(ctx context.Context, rawToken string) (Principal, error) {
	keySet, err := verifier.publicKeySet(ctx)
	if err != nil {
		return Principal{}, fmt.Errorf("%w: key set unavailable: %v", ErrInvalidAccessToken, err)
	}
	token, err := jwt.ParseString(rawToken,
		jwt.WithKeySet(keySet),
		jwt.WithValidate(true),
		jwt.WithIssuer(verifier.issuer),
		jwt.WithAudience(WidgetTokenAudience),
		jwt.WithAcceptableSkew(30*time.Second),
		jwt.WithRequiredClaim("sid"),
		jwt.WithRequiredClaim("scope"),
		jwt.WithRequiredClaim("jti"),
	)
	if err != nil {
		return Principal{}, fmt.Errorf("%w: %v", ErrInvalidAccessToken, err)
	}
	subject, _ := token.Subject()
	tokenId, _ := token.JwtID()
	var sessionId, scope string
	if token.Get("sid", &sessionId) != nil || token.Get("scope", &scope) != nil || subject == "" || sessionId == "" || tokenId == "" || scope != WidgetTokenScope {
		return Principal{}, fmt.Errorf("%w: not a widget token", ErrInvalidAccessToken)
	}
	if isSessionRevokedFailingOpen(ctx, verifier.activeDenylist(), sessionId) {
		return Principal{}, fmt.Errorf("%w: session revoked", ErrInvalidAccessToken)
	}
	if !isWidgetTokenStillCurrent(ctx, RegisteredWidgetTokenRegistry(), sessionId, tokenId) {
		return Principal{}, fmt.Errorf("%w: widget token rotated or revoked", ErrInvalidAccessToken)
	}
	return Principal{UserId: subject, SessionId: sessionId, Scope: WidgetPrincipalScope}, nil
}

func RequireAccessTokenOrWidgetToken(verifier *AccessTokenVerifier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			rawToken := ExtractBearerTokenFromAuthorizationHeader(request)
			if rawToken == "" {
				httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
				return
			}
			principal, err := verifier.VerifyAccessTokenAndExtractPrincipal(request.Context(), rawToken)
			if err != nil {
				principal, err = verifier.VerifyWidgetTokenAndExtractPrincipal(request.Context(), rawToken)
			}
			if err != nil {
				httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
				return
			}
			if slices.Contains(principal.Roles, "suspended") {
				httpserver.WriteJsonResponse(writer, http.StatusForbidden, httpserver.NewForbiddenError("account is suspended"))
				return
			}
			next.ServeHTTP(writer, request.WithContext(ContextWithPrincipal(request.Context(), principal)))
		})
	}
}
