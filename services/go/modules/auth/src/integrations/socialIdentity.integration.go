package integrations

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/lestrrat-go/httprc/v3"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jwt"
)

type Provider string

const (
	Google Provider = "google"
	Apple  Provider = "apple"
)

var (
	ErrProviderNotConfigured = errors.New("social sign-in provider is not configured")
	ErrInvalidIdentityToken  = errors.New("invalid identity token")
)

type VerifiedIdentity struct {
	Provider      Provider
	Subject       string
	Email         string
	EmailVerified bool
	Name          string
}

type providerSettings struct {
	issuers   []string
	audiences []string
	keySet    func(ctx context.Context) (jwk.Set, error)
}

type IdentityTokenVerifier struct {
	providers map[Provider]providerSettings
}

type ProviderConfiguration struct {
	ClientIds []string
	JwksUrl   string
}

func NewIdentityTokenVerifier(ctx context.Context, google, apple ProviderConfiguration) (*IdentityTokenVerifier, error) {
	verifier := &IdentityTokenVerifier{providers: map[Provider]providerSettings{}}
	candidates := []struct {
		provider Provider
		issuers  []string
		config   ProviderConfiguration
	}{
		{Google, []string{"accounts.google.com", "https://accounts.google.com"}, google},
		{Apple, []string{"https://appleid.apple.com"}, apple},
	}
	for _, candidate := range candidates {
		if len(candidate.config.ClientIds) == 0 {
			continue
		}
		keySet, err := newCachedKeySetProvider(ctx, candidate.config.JwksUrl)
		if err != nil {
			return nil, err
		}
		verifier.providers[candidate.provider] = providerSettings{issuers: candidate.issuers, audiences: candidate.config.ClientIds, keySet: keySet}
	}
	return verifier, nil
}

func (verifier *IdentityTokenVerifier) IsConfigured(provider Provider) bool {
	_, configured := verifier.providers[provider]
	return configured
}

func (verifier *IdentityTokenVerifier) VerifyIdentityToken(ctx context.Context, provider Provider, rawToken, nonce string, now time.Time) (VerifiedIdentity, error) {
	settings, configured := verifier.providers[provider]
	if !configured {
		return VerifiedIdentity{}, ErrProviderNotConfigured
	}
	keySet, err := settings.keySet(ctx)
	if err != nil {
		return VerifiedIdentity{}, fmt.Errorf("%w: key set unavailable: %v", ErrInvalidIdentityToken, err)
	}
	token, err := jwt.ParseString(rawToken, jwt.WithKeySet(keySet), jwt.WithValidate(true), jwt.WithClock(jwt.ClockFunc(func() time.Time { return now })), jwt.WithAcceptableSkew(30*time.Second))
	if err != nil {
		return VerifiedIdentity{}, fmt.Errorf("%w: %v", ErrInvalidIdentityToken, err)
	}
	if err := assertClaimsBelongToThisApplication(token, settings, nonce); err != nil {
		return VerifiedIdentity{}, err
	}
	return extractVerifiedIdentity(provider, token), nil
}

func assertClaimsBelongToThisApplication(token jwt.Token, settings providerSettings, nonce string) error {
	issuer, _ := token.Issuer()
	audiences, _ := token.Audience()
	subject, _ := token.Subject()
	if !slices.Contains(settings.issuers, issuer) || subject == "" || !slices.ContainsFunc(audiences, func(audience string) bool { return slices.Contains(settings.audiences, audience) }) {
		return ErrInvalidIdentityToken
	}
	var claimedNonce string
	if err := token.Get("nonce", &claimedNonce); err != nil || !NonceMatches(claimedNonce, nonce) {
		return fmt.Errorf("%w: nonce mismatch", ErrInvalidIdentityToken)
	}
	return nil
}

func NonceMatches(claimed, rawNonce string) bool {
	if len(rawNonce) < 16 || claimed == "" {
		return false
	}
	hashed := sha256.Sum256([]byte(rawNonce))
	rawMatch := subtle.ConstantTimeCompare([]byte(claimed), []byte(rawNonce))
	hashedMatch := subtle.ConstantTimeCompare([]byte(strings.ToLower(claimed)), []byte(hex.EncodeToString(hashed[:])))
	return rawMatch|hashedMatch == 1
}

func extractVerifiedIdentity(provider Provider, token jwt.Token) VerifiedIdentity {
	subject, _ := token.Subject()
	identity := VerifiedIdentity{Provider: provider, Subject: subject}
	var email, name string
	_ = token.Get("email", &email)
	_ = token.Get("name", &name)
	identity.Email, identity.Name = strings.ToLower(strings.TrimSpace(email)), strings.TrimSpace(name)
	var verifiedFlag bool
	if err := token.Get("email_verified", &verifiedFlag); err == nil {
		identity.EmailVerified = verifiedFlag
	} else {
		var verifiedText string
		_ = token.Get("email_verified", &verifiedText)
		identity.EmailVerified = verifiedText == "true"
	}
	return identity
}

func newCachedKeySetProvider(ctx context.Context, jwksUrl string) (func(context.Context) (jwk.Set, error), error) {
	cache, err := jwk.NewCache(ctx, httprc.NewClient())
	if err != nil {
		return nil, fmt.Errorf("create social jwks cache: %w", err)
	}
	if err := cache.Register(ctx, jwksUrl, jwk.WithMinInterval(5*time.Minute), jwk.WithMaxInterval(time.Hour), jwk.WithWaitReady(false)); err != nil {
		return nil, fmt.Errorf("register social jwks url: %w", err)
	}
	return func(ctx context.Context) (jwk.Set, error) {
		if !cache.Ready(ctx, jwksUrl) {
			return cache.Refresh(ctx, jwksUrl)
		}
		return cache.Lookup(ctx, jwksUrl)
	}, nil
}
