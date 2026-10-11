package moneytesting

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"github.com/google/uuid"
	"net/http"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jwt"

	"zudomart/modules/ledger/src/middlewares"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

const (
	TestTokenIssuer   = "https://auth.zudomart.test"
	TestTokenAudience = "zudomart-api"
)

type TestTokenAuthority struct {
	t          *testing.T
	signingKey jwk.Key
	publicSet  jwk.Set
}

func NewTestTokenAuthority(t *testing.T) *TestTokenAuthority {
	t.Helper()
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	signingKey, err := jwk.Import(privateKey)
	if err != nil {
		t.Fatal(err)
	}
	_ = signingKey.Set(jwk.KeyIDKey, "money-test-key")
	_ = signingKey.Set(jwk.AlgorithmKey, jwa.EdDSA())
	publicKey, err := signingKey.PublicKey()
	if err != nil {
		t.Fatal(err)
	}
	publicSet := jwk.NewSet()
	_ = publicSet.AddKey(publicKey)
	return &TestTokenAuthority{t: t, signingKey: signingKey, publicSet: publicSet}
}

func (authority *TestTokenAuthority) verifierFor(audience string) *jwtauth.AccessTokenVerifier {
	return jwtauth.NewAccessTokenVerifierFromKeySetProvider(func(context.Context) (jwk.Set, error) { return authority.publicSet, nil }, TestTokenIssuer, audience)
}

func (authority *TestTokenAuthority) UserVerifier() *jwtauth.AccessTokenVerifier {
	return authority.verifierFor(TestTokenAudience)
}

func (authority *TestTokenAuthority) StaffVerifiers() *middlewares.StaffTokenVerifiers {
	return &middlewares.StaffTokenVerifiers{Access: authority.verifierFor(staffauth.AccessAudience), StepUp: authority.verifierFor(staffauth.StepUpAudience)}
}

func (authority *TestTokenAuthority) sign(subject, sessionId, audience string, roles []string) string {
	authority.t.Helper()
	token, err := jwt.NewBuilder().Issuer(TestTokenIssuer).Subject(subject).Audience([]string{audience}).
		IssuedAt(time.Now()).Expiration(time.Now().Add(15*time.Minute)).JwtID(uuid.NewString()).Claim("sid", sessionId).Claim("roles", roles).Build()
	if err != nil {
		authority.t.Fatal(err)
	}
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.EdDSA(), authority.signingKey))
	if err != nil {
		authority.t.Fatal(err)
	}
	return string(signed)
}

func (authority *TestTokenAuthority) UserAccessToken(userId string) string {
	return authority.sign(userId, "session-"+userId, TestTokenAudience, []string{"user"})
}

type StaffTokens struct {
	AccessToken string
	StepUpToken string
	freshStepUp func() string
}

func (tokens StaffTokens) StepUp() http.Header {
	return http.Header{"X-Step-Up-Token": {tokens.freshStepUp()}}
}

func (authority *TestTokenAuthority) StaffTokens(staffId string, permissions ...string) StaffTokens {
	roles := []string{"admin"}
	for _, permission := range permissions {
		roles = append(roles, "perm:"+permission)
	}
	sessionId := "staff-session-" + staffId
	return StaffTokens{
		AccessToken: authority.sign(staffId, sessionId, staffauth.AccessAudience, roles),
		StepUpToken: authority.sign(staffId, sessionId, staffauth.StepUpAudience, roles),
		freshStepUp: func() string { return authority.sign(staffId, sessionId, staffauth.StepUpAudience, roles) },
	}
}

func (authority *TestTokenAuthority) FreshStaffStepUp(staffId string, permissions ...string) http.Header {
	return http.Header{"X-Step-Up-Token": {authority.StaffTokens(staffId, permissions...).StepUpToken}}
}

func (authority *TestTokenAuthority) UserStepUpToken(userId string) string {
	return authority.sign(userId, "session-"+userId, jwtauth.UserStepUpAudience, []string{"user"})
}

func (authority *TestTokenAuthority) UserWidgetToken(userId string) string {
	authority.t.Helper()
	token, err := jwt.NewBuilder().Issuer(TestTokenIssuer).Subject(userId).Audience([]string{jwtauth.WidgetTokenAudience}).JwtID("widget-"+userId).
		IssuedAt(time.Now()).Expiration(time.Now().Add(time.Hour)).Claim("sid", "session-"+userId).Claim("scope", jwtauth.WidgetTokenScope).Build()
	if err != nil {
		authority.t.Fatal(err)
	}
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.EdDSA(), authority.signingKey))
	if err != nil {
		authority.t.Fatal(err)
	}
	return string(signed)
}
