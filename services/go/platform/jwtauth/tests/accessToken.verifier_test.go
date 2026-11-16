package jwtauth_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwk"

	"nantty/platform/jwtauth"
	"nantty/platform/jwtauth/tests/support"
)

func TestVerifyAccessTokenAndExtractPrincipal(t *testing.T) {
	signingKey, publicSet := support.CreateSigningKeyAndPublicSet(t, "key-1")
	otherKey, _ := support.CreateSigningKeyAndPublicSet(t, "key-unknown")
	verifier := jwtauth.NewAccessTokenVerifierFromKeySetProvider(func(context.Context) (jwk.Set, error) { return publicSet, nil }, "https://auth.nantty.test", "nantty-api")
	cases := []struct {
		name    string
		token   string
		wantErr bool
	}{
		{"valid token", support.SignTestToken(t, signingKey, "nantty-api", time.Now().Add(time.Minute), "session-1"), false},
		{"expired token", support.SignTestToken(t, signingKey, "nantty-api", time.Now().Add(-time.Hour), "session-1"), true},
		{"wrong audience", support.SignTestToken(t, signingKey, "nantty-admin", time.Now().Add(time.Minute), "session-1"), true},
		{"unknown signing key", support.SignTestToken(t, otherKey, "nantty-api", time.Now().Add(time.Minute), "session-1"), true},
		{"missing session claim", support.SignTestToken(t, signingKey, "nantty-api", time.Now().Add(time.Minute), ""), true},
		{"garbage", "not-a-token", true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			principal, err := verifier.VerifyAccessTokenAndExtractPrincipal(context.Background(), testCase.token)
			if testCase.wantErr {
				if !errors.Is(err, jwtauth.ErrInvalidAccessToken) {
					t.Fatalf("expected ErrInvalidAccessToken, got %v", err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if principal.UserId != "user-1" || principal.SessionId != "session-1" || len(principal.Roles) != 1 {
				t.Fatalf("unexpected principal %+v", principal)
			}
		})
	}
}
