package integrations

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"
)

var errPushIdentity = errors.New("google play: the push identity token is not valid")

const (
	googleOidcCertificatesUrl = "https://www.googleapis.com/oauth2/v3/certs"
	googleOidcKeysLifetime    = time.Hour
)

type googleOidcKeys struct {
	mutex     sync.Mutex
	keys      map[string]*rsa.PublicKey
	fetchedAt time.Time
}

func (verifier *GooglePlayVerifier) pushAuthorized(ctx context.Context, presented string) bool {
	if presented == "" {
		return false
	}
	if verifier.settings.PushToken != "" && subtle.ConstantTimeCompare([]byte(presented), []byte(verifier.settings.PushToken)) == 1 {
		return true
	}
	return verifier.settings.PushAudience != "" && strings.Count(presented, ".") == 2 && verifier.verifyPushIdentityToken(ctx, presented) == nil
}

func (verifier *GooglePlayVerifier) verifyPushIdentityToken(ctx context.Context, token string) error {
	parts := strings.Split(token, ".")
	var header struct {
		Algorithm string `json:"alg"`
		KeyId     string `json:"kid"`
	}
	var claims struct {
		Issuer        string `json:"iss"`
		Audience      string `json:"aud"`
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		ExpiresAt     int64  `json:"exp"`
	}
	if decodeJwsSegment(parts[0], &header) != nil || header.Algorithm != "RS256" || decodeJwsSegment(parts[1], &claims) != nil {
		return errPushIdentity
	}
	key, err := verifier.oidcKey(ctx, header.KeyId)
	if err != nil {
		return err
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err != nil || rsa.VerifyPKCS1v15(key, crypto.SHA256, digest[:], signature) != nil {
		return errPushIdentity
	}
	issuerOk := claims.Issuer == "accounts.google.com" || claims.Issuer == "https://accounts.google.com"
	emailOk := verifier.settings.PushServiceAccountEmail == "" || (claims.EmailVerified && claims.Email == verifier.settings.PushServiceAccountEmail)
	if !issuerOk || !emailOk || claims.Audience != verifier.settings.PushAudience || verifier.Now().Unix() >= claims.ExpiresAt {
		return errPushIdentity
	}
	return nil
}

func (verifier *GooglePlayVerifier) oidcKey(ctx context.Context, keyId string) (*rsa.PublicKey, error) {
	cache := &verifier.oidc
	cache.mutex.Lock()
	defer cache.mutex.Unlock()
	if key, found := cache.keys[keyId]; found && verifier.Now().Sub(cache.fetchedAt) < googleOidcKeysLifetime {
		return key, nil
	}
	target := verifier.settings.PushCertificatesUrl
	if target == "" {
		target = googleOidcCertificatesUrl
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return nil, err
	}
	var document struct {
		Keys []struct {
			KeyId    string `json:"kid"`
			Modulus  string `json:"n"`
			Exponent string `json:"e"`
		} `json:"keys"`
	}
	if _, err := sendJsonRequest(verifier.settings.HttpClient, request, &document); err != nil {
		return nil, err
	}
	cache.keys, cache.fetchedAt = map[string]*rsa.PublicKey{}, verifier.Now()
	for _, entry := range document.Keys {
		modulus, modulusErr := base64.RawURLEncoding.DecodeString(entry.Modulus)
		exponent, exponentErr := base64.RawURLEncoding.DecodeString(entry.Exponent)
		if modulusErr == nil && exponentErr == nil {
			cache.keys[entry.KeyId] = &rsa.PublicKey{N: new(big.Int).SetBytes(modulus), E: int(new(big.Int).SetBytes(exponent).Int64())}
		}
	}
	if key, found := cache.keys[keyId]; found {
		return key, nil
	}
	return nil, errPushIdentity
}
