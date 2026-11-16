package jwtauth_test

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jwt"

	"nantty/platform/jwtauth"
)

type widgetRegistry struct {
	mu      sync.Mutex
	current map[string]string
	revoked map[string]bool
	failing bool
}

func newWidgetRegistry() *widgetRegistry {
	return &widgetRegistry{current: map[string]string{}, revoked: map[string]bool{}}
}

func (registry *widgetRegistry) RecordCurrentWidgetToken(_ context.Context, sessionId, tokenId string, _ time.Duration) error {
	registry.mu.Lock()
	defer registry.mu.Unlock()
	registry.current[sessionId] = tokenId
	return nil
}

func (registry *widgetRegistry) IsWidgetTokenCurrent(_ context.Context, sessionId, tokenId string) (bool, error) {
	registry.mu.Lock()
	defer registry.mu.Unlock()
	if registry.failing {
		return false, errors.New("registry unavailable")
	}
	return registry.current[sessionId] == tokenId, nil
}

func (registry *widgetRegistry) ForgetWidgetTokens(_ context.Context, sessionIds []string) error {
	registry.mu.Lock()
	defer registry.mu.Unlock()
	for _, sessionId := range sessionIds {
		delete(registry.current, sessionId)
	}
	return nil
}

func (registry *widgetRegistry) IsSessionRevoked(_ context.Context, sessionId string) (bool, error) {
	registry.mu.Lock()
	defer registry.mu.Unlock()
	if registry.failing {
		return false, errors.New("registry unavailable")
	}
	return registry.revoked[sessionId], nil
}

func (registry *widgetRegistry) RevokeSessions(_ context.Context, sessionIds []string, _ time.Duration) error {
	registry.mu.Lock()
	defer registry.mu.Unlock()
	for _, sessionId := range sessionIds {
		registry.revoked[sessionId] = true
	}
	return nil
}

func widgetVerifier(t *testing.T) (*jwtauth.AccessTokenVerifier, jwk.Key, *widgetRegistry) {
	t.Helper()
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	signingKey, err := jwk.Import(privateKey)
	if err != nil {
		t.Fatal(err)
	}
	if err := signingKey.Set(jwk.KeyIDKey, "widget-test-key"); err != nil {
		t.Fatal(err)
	}
	if err := signingKey.Set(jwk.AlgorithmKey, jwa.EdDSA()); err != nil {
		t.Fatal(err)
	}
	publicSet := jwk.NewSet()
	publicKey, err := signingKey.PublicKey()
	if err != nil {
		t.Fatal(err)
	}
	if err := publicSet.AddKey(publicKey); err != nil {
		t.Fatal(err)
	}
	verifier := jwtauth.NewAccessTokenVerifierFromKeySetProvider(func(context.Context) (jwk.Set, error) {
		return publicSet, nil
	}, "https://auth.nantty.test", "nantty-api")
	registry := newWidgetRegistry()
	jwtauth.RegisterSessionDenylist(registry)
	t.Cleanup(func() { jwtauth.RegisterSessionDenylist(nil) })
	return verifier, signingKey, registry
}

func signWidgetToken(t *testing.T, key jwk.Key, audience, scope, tokenId, sessionId string, expiresAt time.Time) string {
	t.Helper()
	token, err := jwt.NewBuilder().Issuer("https://auth.nantty.test").Subject("user-1").Audience([]string{audience}).
		JwtID(tokenId).IssuedAt(time.Now()).Expiration(expiresAt).Claim("sid", sessionId).Claim("scope", scope).Build()
	if err != nil {
		t.Fatal(err)
	}
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.EdDSA(), key))
	if err != nil {
		t.Fatal(err)
	}
	return string(signed)
}

func signSessionToken(t *testing.T, key jwk.Key, expiresAt time.Time, sessionId string) string {
	t.Helper()
	token, err := jwt.NewBuilder().Issuer("https://auth.nantty.test").Subject("user-1").Audience([]string{"nantty-api"}).
		IssuedAt(time.Now()).Expiration(expiresAt).Claim("sid", sessionId).Build()
	if err != nil {
		t.Fatal(err)
	}
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.EdDSA(), key))
	if err != nil {
		t.Fatal(err)
	}
	return string(signed)
}

func TestWidgetTokenIsRejectedByEveryNonWidgetEndpoint(t *testing.T) {
	verifier, key, registry := widgetVerifier(t)
	_ = registry.RecordCurrentWidgetToken(context.Background(), "session-1", "widget-1", time.Hour)
	widgetToken := signWidgetToken(t, key, jwtauth.WidgetTokenAudience, jwtauth.WidgetTokenScope, "widget-1", "session-1", time.Now().Add(time.Hour))
	if _, err := verifier.VerifyAccessTokenAndExtractPrincipal(context.Background(), widgetToken); !errors.Is(err, jwtauth.ErrInvalidAccessToken) {
		t.Fatalf("widget token must not pass as an access token, got %v", err)
	}
	reached := false
	handler := jwtauth.RequireVerifiedAccessToken(verifier)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { reached = true }))
	request := httptest.NewRequest(http.MethodGet, "/api/v1/orders", nil)
	request.Header.Set("Authorization", "Bearer "+widgetToken)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusUnauthorized || reached {
		t.Fatalf("expected 401 without reaching the handler, got %d reached=%v", recorder.Code, reached)
	}
}

func TestWidgetEndpointAcceptsWidgetAndSessionTokens(t *testing.T) {
	verifier, key, registry := widgetVerifier(t)
	_ = registry.RecordCurrentWidgetToken(context.Background(), "session-1", "widget-1", time.Hour)
	cases := map[string]struct {
		token     string
		wantScope string
	}{
		"widget token":  {signWidgetToken(t, key, jwtauth.WidgetTokenAudience, jwtauth.WidgetTokenScope, "widget-1", "session-1", time.Now().Add(time.Hour)), jwtauth.WidgetPrincipalScope},
		"session token": {signSessionToken(t, key, time.Now().Add(time.Minute), "session-1"), ""},
	}
	for name, testCase := range cases {
		t.Run(name, func(t *testing.T) {
			var seen jwtauth.Principal
			handler := jwtauth.RequireAccessTokenOrWidgetToken(verifier)(http.HandlerFunc(func(_ http.ResponseWriter, request *http.Request) {
				seen, _ = jwtauth.PrincipalFromContext(request.Context())
			}))
			request := httptest.NewRequest(http.MethodGet, "/api/v1/widgets/orders", nil)
			request.Header.Set("Authorization", "Bearer "+testCase.token)
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, request)
			if recorder.Code != http.StatusOK || seen.UserId != "user-1" || seen.Scope != testCase.wantScope {
				t.Fatalf("got %d %+v", recorder.Code, seen)
			}
		})
	}
}

func TestWidgetTokenFailsWhenRevokedRotatedOrMisScoped(t *testing.T) {
	verifier, key, registry := widgetVerifier(t)
	ctx := context.Background()
	valid := func(tokenId string) string {
		return signWidgetToken(t, key, jwtauth.WidgetTokenAudience, jwtauth.WidgetTokenScope, tokenId, "session-1", time.Now().Add(time.Hour))
	}
	_ = registry.RecordCurrentWidgetToken(ctx, "session-1", "widget-2", time.Hour)
	if _, err := verifier.VerifyWidgetTokenAndExtractPrincipal(ctx, valid("widget-1")); err == nil {
		t.Fatal("a rotated-out widget token must fail")
	}
	if _, err := verifier.VerifyWidgetTokenAndExtractPrincipal(ctx, signWidgetToken(t, key, jwtauth.WidgetTokenAudience, "orders:write", "widget-2", "session-1", time.Now().Add(time.Hour))); err == nil {
		t.Fatal("a widget token with another scope must fail")
	}
	if _, err := verifier.VerifyWidgetTokenAndExtractPrincipal(ctx, signWidgetToken(t, key, jwtauth.WidgetTokenAudience, jwtauth.WidgetTokenScope, "widget-2", "session-1", time.Now().Add(-time.Hour))); err == nil {
		t.Fatal("an expired widget token must fail")
	}
	if _, err := verifier.VerifyWidgetTokenAndExtractPrincipal(ctx, valid("widget-2")); err != nil {
		t.Fatalf("current widget token should pass: %v", err)
	}
	registry.mu.Lock()
	registry.failing = true
	registry.mu.Unlock()
	if _, err := verifier.VerifyWidgetTokenAndExtractPrincipal(ctx, valid("widget-2")); err == nil {
		t.Fatal("registry outage must fail closed")
	}
	registry.mu.Lock()
	registry.failing = false
	registry.mu.Unlock()
	jwtauth.DenylistSessions(ctx, []string{"session-1"}, 24*time.Hour)
	if _, err := verifier.VerifyWidgetTokenAndExtractPrincipal(ctx, valid("widget-2")); err == nil {
		t.Fatal("signing out (session revoked) must kill the widget token")
	}
	if current, _ := registry.IsWidgetTokenCurrent(ctx, "session-1", "widget-2"); current {
		t.Fatal("revoking the session should forget its widget token")
	}
}
