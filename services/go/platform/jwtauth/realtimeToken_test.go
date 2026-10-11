package jwtauth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRealtimeTokenIsRejectedByEveryHttpEndpoint(t *testing.T) {
	verifier, key, _ := widgetFixture(t)
	realtime := signWidgetTestToken(t, key, RealtimeTokenAudience, RealtimeTokenScope, "rt-1", "session-1", time.Now().Add(time.Minute))
	sameAudienceScoped := signWidgetTestToken(t, key, "zudomart-api", RealtimeTokenScope, "rt-2", "session-1", time.Now().Add(time.Minute))
	for name, token := range map[string]string{"realtime audience": realtime, "access audience with a scope claim": sameAudienceScoped} {
		t.Run(name, func(t *testing.T) {
			if _, err := verifier.VerifyAccessTokenAndExtractPrincipal(context.Background(), token); !errors.Is(err, ErrInvalidAccessToken) {
				t.Fatalf("realtime token must not pass as an access token, got %v", err)
			}
			if _, err := verifier.VerifyWidgetTokenAndExtractPrincipal(context.Background(), token); !errors.Is(err, ErrInvalidAccessToken) {
				t.Fatalf("realtime token must not pass as a widget token, got %v", err)
			}
			reached := false
			handler := RequireAccessTokenOrWidgetToken(verifier)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { reached = true }))
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
	if RealtimeTokenDefaultTimeToLive < RealtimeTokenMinimumTimeToLive || RealtimeTokenDefaultTimeToLive > RealtimeTokenMaximumTimeToLive || RealtimeTokenMaximumTimeToLive > 2*time.Minute {
		t.Fatal("realtime tokens must live 30-120 seconds")
	}
}
