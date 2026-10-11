package jwtauth

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestRemoteJwksThatWasDownAtStartupNeverHangsRequestsAndRecoversWithoutWaitingForTheRefreshInterval(t *testing.T) {
	signingKey, publicSet := createSigningKeyAndPublicSet(t, "key-1")
	var up atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		if !up.Load() {
			http.Error(writer, "identity is starting", http.StatusServiceUnavailable)
			return
		}
		writer.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(writer).Encode(publicSet)
	}))
	t.Cleanup(server.Close)
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	verifier, err := NewAccessTokenVerifierFromRemoteJwks(ctx, server.URL, "https://auth.zudomart.test", "zudomart-api")
	if err != nil {
		t.Fatal(err)
	}
	token := signTestToken(t, signingKey, "zudomart-api", time.Now().Add(time.Minute), "session-1")
	started := time.Now()
	if _, err := verifier.VerifyAccessTokenAndExtractPrincipal(context.Background(), token); err == nil {
		t.Fatal("a token cannot be verified while the key set is unavailable")
	}
	if waited := time.Since(started); waited > jwksColdFetchTimeout+time.Second {
		t.Fatalf("a request must not hang while the key set is unavailable: waited %s", waited)
	}
	up.Store(true)
	principal, err := verifier.VerifyAccessTokenAndExtractPrincipal(context.Background(), token)
	if err != nil || principal.SessionId != "session-1" {
		t.Fatalf("once identity is up the next request verifies at once: %+v %v", principal, err)
	}
}
