package jwtauth

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jwt"
)

func createSigningKeyAndPublicSet(t *testing.T, keyId string) (jwk.Key, jwk.Set) {
	t.Helper()
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	signingKey, err := jwk.Import(privateKey)
	if err != nil {
		t.Fatal(err)
	}
	_ = signingKey.Set(jwk.KeyIDKey, keyId)
	_ = signingKey.Set(jwk.AlgorithmKey, jwa.EdDSA())
	publicKey, err := signingKey.PublicKey()
	if err != nil {
		t.Fatal(err)
	}
	set := jwk.NewSet()
	_ = set.AddKey(publicKey)
	return signingKey, set
}

func signTestToken(t *testing.T, key jwk.Key, audience string, expiresAt time.Time, sessionId string) string {
	t.Helper()
	builder := jwt.NewBuilder().Issuer("https://auth.nantty.test").Subject("user-1").Audience([]string{audience}).IssuedAt(time.Now()).Expiration(expiresAt)
	if sessionId != "" {
		builder = builder.Claim("sid", sessionId)
	}
	token, err := builder.Claim("roles", []string{"buyer"}).Build()
	if err != nil {
		t.Fatal(err)
	}
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.EdDSA(), key))
	if err != nil {
		t.Fatal(err)
	}
	return string(signed)
}

func TestVerifyAccessTokenAndExtractPrincipal(t *testing.T) {
	signingKey, publicSet := createSigningKeyAndPublicSet(t, "key-1")
	otherKey, _ := createSigningKeyAndPublicSet(t, "key-unknown")
	verifier := NewAccessTokenVerifierFromKeySetProvider(func(context.Context) (jwk.Set, error) { return publicSet, nil }, "https://auth.nantty.test", "nantty-api")
	cases := []struct {
		name    string
		token   string
		wantErr bool
	}{
		{"valid token", signTestToken(t, signingKey, "nantty-api", time.Now().Add(time.Minute), "session-1"), false},
		{"expired token", signTestToken(t, signingKey, "nantty-api", time.Now().Add(-time.Hour), "session-1"), true},
		{"wrong audience", signTestToken(t, signingKey, "nantty-admin", time.Now().Add(time.Minute), "session-1"), true},
		{"unknown signing key", signTestToken(t, otherKey, "nantty-api", time.Now().Add(time.Minute), "session-1"), true},
		{"missing session claim", signTestToken(t, signingKey, "nantty-api", time.Now().Add(time.Minute), ""), true},
		{"garbage", "not-a-token", true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			principal, err := verifier.VerifyAccessTokenAndExtractPrincipal(context.Background(), testCase.token)
			if testCase.wantErr {
				if !errors.Is(err, ErrInvalidAccessToken) {
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
