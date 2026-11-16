package jwtauth_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"nantty/platform/jwtauth"
)

func TestRealtimeTokenIsRejectedByEveryHttpEndpoint(t *testing.T) {
	verifier, key, _ := widgetVerifier(t)
	realtime := signWidgetToken(t, key, jwtauth.RealtimeTokenAudience, jwtauth.RealtimeTokenScope, "rt-1", "session-1", time.Now().Add(time.Minute))
	sameAudienceScoped := signWidgetToken(t, key, "nantty-api", jwtauth.RealtimeTokenScope, "rt-2", "session-1", time.Now().Add(time.Minute))
	for name, token := range map[string]string{"realtime audience": realtime, "access audience with a scope claim": sameAudienceScoped} {
		t.Run(name, func(t *testing.T) {
			if _, err := verifier.VerifyAccessTokenAndExtractPrincipal(context.Background(), token); !errors.Is(err, jwtauth.ErrInvalidAccessToken) {
				t.Fatalf("realtime token must not pass as an access token, got %v", err)
			}
			if _, err := verifier.VerifyWidgetTokenAndExtractPrincipal(context.Background(), token); !errors.Is(err, jwtauth.ErrInvalidAccessToken) {
				t.Fatalf("realtime token must not pass as a widget token, got %v", err)
			}
			reached := false
			handler := jwtauth.RequireAccessTokenOrWidgetToken(verifier)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { reached = true }))
			request := httptest.NewRequest(http.MethodGet, "/api/v1/widgets/orders", nil)
			request.Header.Set("Authorization", "Bearer "+token)
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, request)
			if recorder.Code != http.StatusUnauthorized || reached {
				t.Fatalf("expected 401, got %d reached=%v", recorder.Code, reached)
			}
		})
	}
}

func TestRealtimeTokenLifetimeBounds(t *testing.T) {
	if jwtauth.RealtimeTokenDefaultTimeToLive < jwtauth.RealtimeTokenMinimumTimeToLive || jwtauth.RealtimeTokenDefaultTimeToLive > jwtauth.RealtimeTokenMaximumTimeToLive || jwtauth.RealtimeTokenMaximumTimeToLive > 2*time.Minute {
		t.Fatal("realtime tokens must live 30-120 seconds")
	}
}
