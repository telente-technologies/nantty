package services

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwt"
)

type AccessTokenClaims struct {
	AccountId  string
	SessionId  string
	Roles      []string
	AgeBracket string
	Scope      string
	TokenId    string
}

type AccessTokenIssuer struct {
	keys       *SigningKeyService
	issuer     string
	audience   string
	timeToLive time.Duration
	now        func() time.Time
}

func NewAccessTokenIssuer(keys *SigningKeyService, issuer, audience string, timeToLive time.Duration, now func() time.Time) *AccessTokenIssuer {
	return &AccessTokenIssuer{keys: keys, issuer: issuer, audience: audience, timeToLive: timeToLive, now: now}
}

func (issuer *AccessTokenIssuer) TimeToLiveInSeconds() int {
	return int(issuer.timeToLive.Seconds())
}

func (issuer *AccessTokenIssuer) SignAccessTokenWithActiveKey(claims AccessTokenClaims) (string, error) {
	return issuer.SignTokenForAudience(issuer.audience, issuer.timeToLive, claims)
}

func (issuer *AccessTokenIssuer) Issuer() string { return issuer.issuer }

func (issuer *AccessTokenIssuer) SignTokenForAudience(audience string, timeToLive time.Duration, claims AccessTokenClaims) (string, error) {
	signingKey, err := issuer.keys.CurrentSigningKey()
	if err != nil {
		return "", err
	}
	issuedAt := issuer.now()
	tokenId := claims.TokenId
	if tokenId == "" {
		tokenId = uuid.NewString()
	}
	builder := jwt.NewBuilder().
		Issuer(issuer.issuer).
		Audience([]string{audience}).
		Subject(claims.AccountId).
		JwtID(tokenId).
		IssuedAt(issuedAt).
		NotBefore(issuedAt).
		Expiration(issuedAt.Add(timeToLive)).
		Claim("sid", claims.SessionId).
		Claim("roles", claims.Roles)
	if claims.Scope != "" {
		builder = builder.Claim("scope", claims.Scope)
	}
	if claims.AgeBracket != "" {
		builder = builder.Claim("age", claims.AgeBracket)
	}
	token, err := builder.Build()
	if err != nil {
		return "", fmt.Errorf("build access token: %w", err)
	}
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.EdDSA(), signingKey))
	if err != nil {
		return "", fmt.Errorf("sign access token: %w", err)
	}
	return string(signed), nil
}
