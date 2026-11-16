package jwtauth_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwk"

	"nantty/platform/jwtauth"
	"nantty/platform/jwtauth/tests/support"
)

func TestRequireUserStepUpAcceptsOnlyAFreshTokenForTheSameSession(t *testing.T) {
	signingKey, publicSet := support.CreateSigningKeyAndPublicSet(t, "key-1")
	verifier := jwtauth.NewAccessTokenVerifierFromKeySetProvider(func(context.Context) (jwk.Set, error) { return publicSet, nil }, "https://auth.nantty.test", "nantty-api")
	cases := []struct {
		name   string
		header string
		want   int
	}{
		{"valid step-up", support.SignTestToken(t, signingKey, jwtauth.UserStepUpAudience, time.Now().Add(time.Minute), "session-1"), http.StatusNoContent},
		{"missing header", "", http.StatusForbidden},
		{"expired step-up", support.SignTestToken(t, signingKey, jwtauth.UserStepUpAudience, time.Now().Add(-time.Hour), "session-1"), http.StatusForbidden},
		{"another session", support.SignTestToken(t, signingKey, jwtauth.UserStepUpAudience, time.Now().Add(time.Minute), "session-2"), http.StatusForbidden},
		{"plain access token", support.SignTestToken(t, signingKey, "nantty-api", time.Now().Add(time.Minute), "session-1"), http.StatusForbidden},
	}
	guarded := jwtauth.RequireUserStepUp(verifier)(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) { writer.WriteHeader(http.StatusNoContent) }))
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "/api/v1/wallets/me/withdrawals", nil)
			if testCase.header != "" {
				request.Header.Set(jwtauth.UserStepUpHeader, testCase.header)
			}
			request = request.WithContext(jwtauth.ContextWithPrincipal(request.Context(), jwtauth.Principal{UserId: "user-1", SessionId: "session-1"}))
			recorder := httptest.NewRecorder()
			guarded.ServeHTTP(recorder, request)
			if recorder.Code != testCase.want {
				t.Fatalf("status %d, want %d (%s)", recorder.Code, testCase.want, recorder.Body.String())
			}
		})
	}
	unauthenticated := httptest.NewRecorder()
	guarded.ServeHTTP(unauthenticated, httptest.NewRequest(http.MethodPost, "/", nil))
	if unauthenticated.Code != http.StatusForbidden {
		t.Fatalf("no principal must be refused, got %d", unauthenticated.Code)
	}
}
