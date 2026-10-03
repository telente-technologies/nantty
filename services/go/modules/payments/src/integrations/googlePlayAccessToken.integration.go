package integrations

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const googlePlayPublisherScope = "https://www.googleapis.com/auth/androidpublisher"

type googleServiceAccount struct {
	ClientEmail string `json:"client_email"`
	PrivateKey  string `json:"private_key"`
	TokenUri    string `json:"token_uri"`
}

type googleAccessTokenSource struct {
	account    googleServiceAccount
	signingKey *rsa.PrivateKey
	client     *http.Client
	now        func() time.Time
	mutex      sync.Mutex
	token      string
	expiresAt  time.Time
}

func newGoogleAccessTokenSource(serviceAccountJson []byte, client *http.Client, now func() time.Time) (*googleAccessTokenSource, error) {
	var account googleServiceAccount
	if err := json.Unmarshal(serviceAccountJson, &account); err != nil || account.ClientEmail == "" || account.PrivateKey == "" {
		return nil, errors.New("google play: the service account JSON is incomplete")
	}
	if account.TokenUri == "" {
		account.TokenUri = "https://oauth2.googleapis.com/token"
	}
	block, _ := pem.Decode([]byte(account.PrivateKey))
	if block == nil {
		return nil, errors.New("google play: the service account private key is not PEM")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	key, isRsa := parsed.(*rsa.PrivateKey)
	if !isRsa {
		return nil, errors.New("google play: the service account key must be RSA")
	}
	return &googleAccessTokenSource{account: account, signingKey: key, client: client, now: now}, nil
}

func (source *googleAccessTokenSource) AccessToken(ctx context.Context) (string, error) {
	source.mutex.Lock()
	defer source.mutex.Unlock()
	if source.token != "" && source.now().Before(source.expiresAt.Add(-time.Minute)) {
		return source.token, nil
	}
	assertion, err := source.signAssertion()
	if err != nil {
		return "", err
	}
	form := url.Values{"grant_type": {"urn:ietf:params:oauth:grant-type:jwt-bearer"}, "assertion": {assertion}}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, source.account.TokenUri, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	var response struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	if _, err := sendJsonRequest(source.client, request, &response); err != nil {
		return "", err
	}
	if response.AccessToken == "" {
		return "", errors.New("google play: the token endpoint returned no access token")
	}
	source.token, source.expiresAt = response.AccessToken, source.now().Add(time.Duration(response.ExpiresIn)*time.Second)
	return source.token, nil
}

func (source *googleAccessTokenSource) signAssertion() (string, error) {
	now := source.now()
	header := map[string]string{"alg": "RS256", "typ": "JWT"}
	claims := map[string]any{"iss": source.account.ClientEmail, "scope": googlePlayPublisherScope, "aud": source.account.TokenUri, "iat": now.Unix(), "exp": now.Add(time.Hour).Unix()}
	signingInput := encodeJwsSegment(header) + "." + encodeJwsSegment(claims)
	digest := sha256.Sum256([]byte(signingInput))
	signature, err := rsa.SignPKCS1v15(rand.Reader, source.signingKey, crypto.SHA256, digest[:])
	if err != nil {
		return "", err
	}
	return signingInput + "." + base64.RawURLEncoding.EncodeToString(signature), nil
}
