package support

import (
	"crypto/ed25519"
	"crypto/rand"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jwt"
)

func CreateSigningKeyAndPublicSet(t *testing.T, keyId string) (jwk.Key, jwk.Set) {
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

func SignTestToken(t *testing.T, key jwk.Key, audience string, expiresAt time.Time, sessionId string) string {
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
