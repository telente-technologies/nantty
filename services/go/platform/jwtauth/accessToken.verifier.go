package jwtauth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/lestrrat-go/httprc/v3"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jwt"
)

type Principal struct {
	UserId    string
	SessionId string
	Roles     []string
}

type KeySetProvider func(ctx context.Context) (jwk.Set, error)

type AccessTokenVerifier struct {
	publicKeySet KeySetProvider
	issuer       string
	audience     string
	denylist     SessionDenylist
}

func (verifier *AccessTokenVerifier) WithSessionDenylist(denylist SessionDenylist) *AccessTokenVerifier {
	copied := *verifier
	copied.denylist = denylist
	return &copied
}

func (verifier *AccessTokenVerifier) activeDenylist() SessionDenylist {
	if verifier.denylist != nil {
		return verifier.denylist
	}
	return RegisteredSessionDenylist()
}

var ErrInvalidAccessToken = errors.New("invalid access token")

func NewAccessTokenVerifierFromKeySetProvider(provider KeySetProvider, issuer, audience string) *AccessTokenVerifier {
	return &AccessTokenVerifier{publicKeySet: provider, issuer: issuer, audience: audience}
}

func NewAccessTokenVerifierFromRemoteJwks(ctx context.Context, jwksUrl, issuer, audience string) (*AccessTokenVerifier, error) {
	cache, err := jwk.NewCache(ctx, httprc.NewClient())
	if err != nil {
		return nil, fmt.Errorf("create jwks cache: %w", err)
	}
	if err := cache.Register(ctx, jwksUrl, jwk.WithMinInterval(time.Minute), jwk.WithMaxInterval(15*time.Minute), jwk.WithWaitReady(false)); err != nil {
		return nil, fmt.Errorf("register jwks url: %w", err)
	}
	provider := func(ctx context.Context) (jwk.Set, error) {
		if !cache.Ready(ctx, jwksUrl) {
			return cache.Refresh(ctx, jwksUrl)
		}
		return cache.Lookup(ctx, jwksUrl)
	}
	return NewAccessTokenVerifierFromKeySetProvider(provider, issuer, audience), nil
}

func (verifier *AccessTokenVerifier) VerifyAccessTokenAndExtractPrincipal(ctx context.Context, rawToken string) (Principal, error) {
	keySet, err := verifier.publicKeySet(ctx)
	if err != nil {
		return Principal{}, fmt.Errorf("%w: key set unavailable: %v", ErrInvalidAccessToken, err)
	}
	token, err := jwt.ParseString(rawToken,
		jwt.WithKeySet(keySet),
		jwt.WithValidate(true),
		jwt.WithIssuer(verifier.issuer),
		jwt.WithAudience(verifier.audience),
		jwt.WithAcceptableSkew(30*time.Second),
		jwt.WithRequiredClaim("sid"),
	)
	if err != nil {
		return Principal{}, fmt.Errorf("%w: %v", ErrInvalidAccessToken, err)
	}
	subject, hasSubject := token.Subject()
	if !hasSubject || subject == "" {
		return Principal{}, fmt.Errorf("%w: missing subject", ErrInvalidAccessToken)
	}
	var sessionId string
	if err := token.Get("sid", &sessionId); err != nil || sessionId == "" {
		return Principal{}, fmt.Errorf("%w: missing session", ErrInvalidAccessToken)
	}
	if isSessionRevokedFailingOpen(ctx, verifier.activeDenylist(), sessionId) {
		return Principal{}, fmt.Errorf("%w: session revoked", ErrInvalidAccessToken)
	}
	var roles []string
	if token.Has("roles") {
		var rawRoles []any
		if err := token.Get("roles", &rawRoles); err == nil {
			for _, role := range rawRoles {
				if name, isString := role.(string); isString {
					roles = append(roles, name)
				}
			}
		}
	}
	return Principal{UserId: subject, SessionId: sessionId, Roles: roles}, nil
}
