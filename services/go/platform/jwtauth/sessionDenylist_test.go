package jwtauth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwk"
)

type fakeDenylist struct {
	mutex   sync.Mutex
	revoked map[string]time.Duration
	failing bool
}

func newFakeDenylist() *fakeDenylist { return &fakeDenylist{revoked: map[string]time.Duration{}} }

func (denylist *fakeDenylist) IsSessionRevoked(_ context.Context, sessionId string) (bool, error) {
	denylist.mutex.Lock()
	defer denylist.mutex.Unlock()
	if denylist.failing {
		return false, errors.New("valkey unavailable")
	}
	_, found := denylist.revoked[sessionId]
	return found, nil
}

func (denylist *fakeDenylist) RevokeSessions(_ context.Context, sessionIds []string, ttl time.Duration) error {
	denylist.mutex.Lock()
	defer denylist.mutex.Unlock()
	if denylist.failing {
		return errors.New("valkey unavailable")
	}
	for _, sessionId := range sessionIds {
		denylist.revoked[sessionId] = ttl
	}
	return nil
}

func verifierWithFreshKey(t *testing.T) (*AccessTokenVerifier, func(sessionId string) string) {
	t.Helper()
	signingKey, publicSet := createSigningKeyAndPublicSet(t, "key-1")
	verifier := NewAccessTokenVerifierFromKeySetProvider(func(context.Context) (jwk.Set, error) { return publicSet, nil }, "https://auth.zudomart.test", "zudomart-api")
	sign := func(sessionId string) string {
		return signTestToken(t, signingKey, "zudomart-api", time.Now().Add(10*time.Minute), sessionId)
	}
	return verifier, sign
}

func TestRevokedSessionTokenIsRejected(t *testing.T) {
	verifier, sign := verifierWithFreshKey(t)
	denylist := newFakeDenylist()
	guarded := verifier.WithSessionDenylist(denylist)
	token := sign("session-a")
	if _, err := guarded.VerifyAccessTokenAndExtractPrincipal(context.Background(), token); err != nil {
		t.Fatalf("token before revocation should verify: %v", err)
	}
	_ = denylist.RevokeSessions(context.Background(), []string{"session-a"}, time.Minute)
	if _, err := guarded.VerifyAccessTokenAndExtractPrincipal(context.Background(), token); !errors.Is(err, ErrInvalidAccessToken) {
		t.Fatalf("revoked session token must be rejected, got %v", err)
	}
	if _, err := guarded.VerifyAccessTokenAndExtractPrincipal(context.Background(), sign("session-b")); err != nil {
		t.Fatalf("other sessions must stay valid: %v", err)
	}
}

func TestMiddlewareReturns401ForRevokedSession(t *testing.T) {
	verifier, sign := verifierWithFreshKey(t)
	denylist := newFakeDenylist()
	_ = denylist.RevokeSessions(context.Background(), []string{"session-a"}, time.Minute)
	handler := RequireVerifiedAccessToken(verifier.WithSessionDenylist(denylist))(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusOK)
	}))
	for sessionId, want := range map[string]int{"session-a": http.StatusUnauthorized, "session-b": http.StatusOK} {
		request := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
		request.Header.Set("Authorization", "Bearer "+sign(sessionId))
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, request)
		if recorder.Code != want {
			t.Fatalf("%s: status %d, want %d", sessionId, recorder.Code, want)
		}
	}
}

func TestDenylistOutageFailsClosedAndCountsFailure(t *testing.T) {
	verifier, sign := verifierWithFreshKey(t)
	denylist := newFakeDenylist()
	denylist.failing = true
	before := SessionDenylistCheckFailures()
	if _, err := verifier.WithSessionDenylist(denylist).VerifyAccessTokenAndExtractPrincipal(context.Background(), sign("session-a")); !errors.Is(err, ErrInvalidAccessToken) {
		t.Fatalf("outage must fail closed, got %v", err)
	}
	if SessionDenylistCheckFailures() != before+1 {
		t.Fatal("outage must increment the check-failure metric")
	}
}

func TestRegisteredDenylistIsUsedAndWrittenWithTtl(t *testing.T) {
	verifier, sign := verifierWithFreshKey(t)
	denylist := newFakeDenylist()
	RegisterSessionDenylist(denylist)
	t.Cleanup(func() { RegisterSessionDenylist(nil) })
	DenylistSessions(context.Background(), []string{"session-a"}, 16*time.Minute)
	if denylist.revoked["session-a"] != 16*time.Minute {
		t.Fatalf("denylist ttl not applied: %v", denylist.revoked)
	}
	if _, err := verifier.VerifyAccessTokenAndExtractPrincipal(context.Background(), sign("session-a")); !errors.Is(err, ErrInvalidAccessToken) {
		t.Fatalf("registered denylist must apply to verifiers without an override, got %v", err)
	}
}

func TestDenylistWriteFailureIsCountedNotPanicking(t *testing.T) {
	denylist := newFakeDenylist()
	denylist.failing = true
	RegisterSessionDenylist(denylist)
	t.Cleanup(func() { RegisterSessionDenylist(nil) })
	before := SessionDenylistWriteFailures()
	DenylistSessions(context.Background(), []string{"session-a"}, time.Minute)
	if SessionDenylistWriteFailures() != before+1 {
		t.Fatal("write failure must be counted")
	}
}

func TestDenylistPingFailsWhenValkeyIsUnreachable(t *testing.T) {
	denylist, err := NewRedisSessionDenylistFromUrl("redis://127.0.0.1:1/0")
	if err != nil {
		t.Fatal(err)
	}
	defer denylist.Close()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := denylist.Ping(ctx); err == nil {
		t.Fatal("ping to a closed port must fail so readiness reports the cache as down")
	}
}
