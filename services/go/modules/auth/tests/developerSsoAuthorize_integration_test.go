package auth_test

import (
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

func TestDeveloperSsoAuthorizeRequiresBoundedState(t *testing.T) {
	t.Setenv("AUTH_DEVELOPER_SSO_CLIENT_ID", "developer")
	t.Setenv("AUTH_DEVELOPER_SSO_CLIENT_SECRET", "local-test-client-secret")
	t.Setenv("AUTH_DEVELOPER_SSO_REDIRECT_URIS", "https://developer.example/callback")
	t.Setenv("AUTH_DEVELOPER_SSO_LOGIN_URL", "")
	harness := startAuthModuleAgainstFreshSchema(t)

	verifierDigest := sha256.Sum256([]byte("sso-state-test-verifier"))
	validChallenge := base64.RawURLEncoding.EncodeToString(verifierDigest[:])
	base64URLAlphabet := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
	lastChallengeCharacter := strings.IndexByte(base64URLAlphabet, validChallenge[len(validChallenge)-1])
	noncanonicalChallenge := validChallenge[:len(validChallenge)-1] + string(base64URLAlphabet[lastChallengeCharacter+1])
	base := "/api/v1/auth/sso/authorize?client_id=developer&redirect_uri=" + url.QueryEscape("https://developer.example/callback") +
		"&code_challenge=" + validChallenge + "&code_challenge_method=S256"
	for name, query := range map[string]string{
		"missing":                "",
		"too short":              "&state=short",
		"too long":               "&state=" + strings.Repeat("a", 513),
		"blank":                  "&state=" + url.QueryEscape(strings.Repeat(" ", 16)),
		"duplicate state":        "&state=" + strings.Repeat("s", 32) + "&state=" + strings.Repeat("t", 32),
		"duplicate client id":    "&client_id=developer&state=" + strings.Repeat("s", 32),
		"duplicate redirect uri": "&redirect_uri=" + url.QueryEscape("https://developer.example/callback") + "&state=" + strings.Repeat("s", 32),
		"invalid challenge":      "&state=" + strings.Repeat("s", 32) + "&code_challenge=" + strings.Repeat("a", 44),
		"noncanonical challenge": "&state=" + strings.Repeat("s", 32) + "&code_challenge=" + noncanonicalChallenge,
	} {
		t.Run(name, func(t *testing.T) {
			status, body := harness.call(http.MethodGet, base+query, "", nil)
			if status != http.StatusBadRequest || body["code"] != "INVALID_SSO_REQUEST" {
				t.Fatalf("invalid OAuth state response = %d %v, want 400 INVALID_SSO_REQUEST", status, body)
			}
		})
	}

	status, body := harness.call(http.MethodGet, base+"&state="+url.QueryEscape(strings.Repeat("s", 32)), "", nil)
	if status != http.StatusUnauthorized || body["code"] != "UNAUTHORIZED" {
		t.Fatalf("valid-state request should proceed to authentication, got %d %v", status, body)
	}
}
