package jwtauth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jwt"
)

type fakeWidgetRegistry struct {
	*fakeDenylist
	widgetMutex sync.Mutex
	current     map[string]string
	failing     bool
}

func newFakeWidgetRegistry() *fakeWidgetRegistry {
	return &fakeWidgetRegistry{fakeDenylist: newFakeDenylist(), current: map[string]string{}}
}

func (registry *fakeWidgetRegistry) RecordCurrentWidgetToken(_ context.Context, sessionId, tokenId string, _ time.Duration) error {
	registry.widgetMutex.Lock()
	defer registry.widgetMutex.Unlock()
	registry.current[sessionId] = tokenId
	return nil
}

func (registry *fakeWidgetRegistry) IsWidgetTokenCurrent(_ context.Context, sessionId, tokenId string) (bool, error) {
	registry.widgetMutex.Lock()
	defer registry.widgetMutex.Unlock()
	if registry.failing {
		return false, errors.New("valkey unavailable")
	}
	return registry.current[sessionId] == tokenId, nil
}

func (registry *fakeWidgetRegistry) ForgetWidgetTokens(_ context.Context, sessionIds []string) error {
	registry.widgetMutex.Lock()
	defer registry.widgetMutex.Unlock()
	for _, sessionId := range sessionIds {
		delete(registry.current, sessionId)
	}
	return nil
}

func signWidgetTestToken(t *testing.T, key jwk.Key, audience, scope, tokenId, sessionId string, expiresAt time.Time) string {
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

func widgetFixture(t *testing.T) (*AccessTokenVerifier, jwk.Key, *fakeWidgetRegistry) {
	t.Helper()
	signingKey, publicSet := createSigningKeyAndPublicSet(t, "key-1")
	verifier := NewAccessTokenVerifierFromKeySetProvider(func(context.Context) (jwk.Set, error) { return publicSet, nil }, "https://auth.nantty.test", "nantty-api")
	registry := newFakeWidgetRegistry()
	RegisterSessionDenylist(registry)
	t.Cleanup(func() { RegisterSessionDenylist(nil) })
	return verifier, signingKey, registry
}

func TestWidgetTokenIsRejectedByEveryNonWidgetEndpoint(t *testing.T) {
	verifier, key, registry := widgetFixture(t)
	_ = registry.RecordCurrentWidgetToken(context.Background(), "session-1", "widget-1", time.Hour)
	widgetToken := signWidgetTestToken(t, key, WidgetTokenAudience, WidgetTokenScope, "widget-1", "session-1", time.Now().Add(time.Hour))
	if _, err := verifier.VerifyAccessTokenAndExtractPrincipal(context.Background(), widgetToken); !errors.Is(err, ErrInvalidAccessToken) {
		t.Fatalf("widget token must not pass as an access token, got %v", err)
	}
	reached := false
	handler := RequireVerifiedAccessToken(verifier)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { reached = true }))
	request := httptest.NewRequest(http.MethodGet, "/api/v1/orders", nil)
	request.Header.Set("Authorization", "Bearer "+widgetToken)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusUnauthorized || reached {
		t.Fatalf("expected 401 without reaching the handler, got %d reached=%v", recorder.Code, reached)
	}
}

func TestWidgetEndpointAcceptsWidgetAndSessionTokens(t *testing.T) {
	verifier, key, registry := widgetFixture(t)
	_ = registry.RecordCurrentWidgetToken(context.Background(), "session-1", "widget-1", time.Hour)
	cases := map[string]struct {
		token     string
		wantScope string
	}{
		"widget token":  {signWidgetTestToken(t, key, WidgetTokenAudience, WidgetTokenScope, "widget-1", "session-1", time.Now().Add(time.Hour)), WidgetPrincipalScope},
		"session token": {signTestToken(t, key, "nantty-api", time.Now().Add(time.Minute), "session-1"), ""},
	}
	for name, testCase := range cases {
		t.Run(name, func(t *testing.T) {
			var seen Principal
			handler := RequireAccessTokenOrWidgetToken(verifier)(http.HandlerFunc(func(_ http.ResponseWriter, request *http.Request) {
				seen, _ = PrincipalFromContext(request.Context())
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
	verifier, key, registry := widgetFixture(t)
	ctx := context.Background()
	valid := func(tokenId string) string {
		return signWidgetTestToken(t, key, WidgetTokenAudience, WidgetTokenScope, tokenId, "session-1", time.Now().Add(time.Hour))
	}
	_ = registry.RecordCurrentWidgetToken(ctx, "session-1", "widget-2", time.Hour)
	if _, err := verifier.VerifyWidgetTokenAndExtractPrincipal(ctx, valid("widget-1")); err == nil {
		t.Fatal("a rotated-out widget token must fail")
	}
	if _, err := verifier.VerifyWidgetTokenAndExtractPrincipal(ctx, signWidgetTestToken(t, key, WidgetTokenAudience, "orders:write", "widget-2", "session-1", time.Now().Add(time.Hour))); err == nil {
		t.Fatal("a widget token with another scope must fail")
	}
	if _, err := verifier.VerifyWidgetTokenAndExtractPrincipal(ctx, signWidgetTestToken(t, key, WidgetTokenAudience, WidgetTokenScope, "widget-2", "session-1", time.Now().Add(-time.Hour))); err == nil {
		t.Fatal("an expired widget token must fail")
	}
	if _, err := verifier.VerifyWidgetTokenAndExtractPrincipal(ctx, valid("widget-2")); err != nil {
		t.Fatalf("current widget token should pass: %v", err)
	}
	registry.failing = true
	if _, err := verifier.VerifyWidgetTokenAndExtractPrincipal(ctx, valid("widget-2")); err == nil {
		t.Fatal("registry outage must fail closed")
	}
	registry.failing = false
	DenylistSessions(ctx, []string{"session-1"}, 24*time.Hour)
	if _, err := verifier.VerifyWidgetTokenAndExtractPrincipal(ctx, valid("widget-2")); err == nil {
		t.Fatal("signing out (session revoked) must kill the widget token")
	}
	if current, _ := registry.IsWidgetTokenCurrent(ctx, "session-1", "widget-2"); current {
		t.Fatal("revoking the session should forget its widget token")
	}
}
