package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jwt"

	"zudomart/modules/auth/src/configs"
)

type fakeIdentityProvider struct {
	key       jwk.Key
	jwksUrl   string
	audience  string
	issuer    string
	closeJwks func()
}

func startFakeIdentityProvider(t *testing.T, issuer, audience string) *fakeIdentityProvider {
	t.Helper()
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	signingKey, _ := jwk.Import(privateKey)
	_ = signingKey.Set(jwk.KeyIDKey, "test-key")
	_ = signingKey.Set(jwk.AlgorithmKey, jwa.RS256())
	publicKey, _ := jwk.PublicKeyOf(signingKey)
	set := jwk.NewSet()
	_ = set.AddKey(publicKey)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(writer).Encode(set)
	}))
	t.Cleanup(server.Close)
	return &fakeIdentityProvider{key: signingKey, jwksUrl: server.URL, audience: audience, issuer: issuer}
}

func (provider *fakeIdentityProvider) signToken(t *testing.T, subject, email string, emailVerified any, nonce string) string {
	t.Helper()
	token, err := jwt.NewBuilder().Issuer(provider.issuer).Audience([]string{provider.audience}).Subject(subject).
		IssuedAt(time.Now()).Expiration(time.Now().Add(time.Hour)).
		Claim("email", email).Claim("email_verified", emailVerified).Claim("name", "Grace Hopper").Claim("nonce", nonce).Build()
	if err != nil {
		t.Fatal(err)
	}
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.RS256(), provider.key))
	if err != nil {
		t.Fatal(err)
	}
	return string(signed)
}

func (harness *authTestHarness) registerAccountAndLogIn(email, password string) map[string]any {
	harness.t.Helper()
	harness.expect("POST", "/api/v1/auth/otp/send", "", map[string]string{"destination": email, "purpose": "signup"}, http.StatusOK)
	otpToken := harness.expect("POST", "/api/v1/auth/otp/verify", "", map[string]string{"destination": email, "code": harness.lastLoggedOneTimeCode(), "purpose": "signup"}, http.StatusOK)["otpToken"].(string)
	return harness.expect("POST", "/api/v1/auth/register", "", map[string]string{"email": email, "birthday": "1990-01-01", "password": password, "otpToken": otpToken}, http.StatusCreated)
}

func TestPasswordResetRevokesEverySessionAndChangeKeepsTheCurrentOne(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	email := "reset.me@example.com"
	first := harness.registerAccountAndLogIn(email, "firstpass1")
	second := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "firstpass1"}, http.StatusOK)

	harness.expect("POST", "/api/v1/auth/password/reset", "", map[string]string{"otpToken": "not-a-real-token-at-all-0000", "password": "brandnew2"}, http.StatusBadRequest)
	harness.expect("POST", "/api/v1/auth/otp/send", "", map[string]string{"destination": email, "purpose": "reset"}, http.StatusOK)
	otpToken := harness.expect("POST", "/api/v1/auth/otp/verify", "", map[string]string{"destination": email, "code": harness.lastLoggedOneTimeCode(), "purpose": "reset"}, http.StatusOK)["otpToken"].(string)
	harness.expect("POST", "/api/v1/auth/password/reset", "", map[string]string{"otpToken": otpToken, "password": "short"}, http.StatusUnprocessableEntity)
	harness.expect("POST", "/api/v1/auth/password/reset", "", map[string]string{"otpToken": otpToken, "password": "brandnew2"}, http.StatusNoContent)
	harness.expect("POST", "/api/v1/auth/password/reset", "", map[string]string{"otpToken": otpToken, "password": "another3pass"}, http.StatusBadRequest)

	harness.expect("POST", "/api/v1/auth/refresh", "", map[string]string{"refreshToken": first["refreshToken"].(string)}, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/auth/refresh", "", map[string]string{"refreshToken": second["refreshToken"].(string)}, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "firstpass1"}, http.StatusUnauthorized)
	current := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "brandnew2"}, http.StatusOK)
	other := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "brandnew2"}, http.StatusOK)

	accessToken := current["accessToken"].(string)
	harness.expect("POST", "/api/v1/auth/password/change", "", map[string]string{"currentPassword": "brandnew2", "newPassword": "changed4pass"}, http.StatusUnauthorized)
	wrong := harness.expect("POST", "/api/v1/auth/password/change", accessToken, map[string]string{"currentPassword": "nope-nope1", "newPassword": "changed4pass"}, http.StatusUnauthorized)
	if wrong["code"] != "CURRENT_PASSWORD_INCORRECT" {
		t.Fatalf("unexpected %v", wrong)
	}
	harness.expect("POST", "/api/v1/auth/password/change", accessToken, map[string]string{"currentPassword": "brandnew2", "newPassword": "weak"}, http.StatusUnprocessableEntity)
	harness.expect("POST", "/api/v1/auth/password/change", accessToken, map[string]string{"currentPassword": "brandnew2", "newPassword": "changed4pass"}, http.StatusNoContent)
	harness.expect("POST", "/api/v1/auth/refresh", "", map[string]string{"refreshToken": other["refreshToken"].(string)}, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/auth/refresh", "", map[string]string{"refreshToken": current["refreshToken"].(string)}, http.StatusOK)
	waitForPublishedEventTypes(t, harness.publisher, "account.passwordChanged", "session.revoked")
}

func TestListingAndRevokingSessions(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	email := "sessions@example.com"
	first := harness.registerAccountAndLogIn(email, "sessionpass1")
	second := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "sessionpass1"}, http.StatusOK)
	third := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "sessionpass1"}, http.StatusOK)

	harness.expect("GET", "/api/v1/auth/sessions", "", nil, http.StatusUnauthorized)
	listed := harness.expect("GET", "/api/v1/auth/sessions", second["accessToken"].(string), nil, http.StatusOK)
	sessions := listed["data"].([]any)
	if len(sessions) != 3 || listed["nextCursor"] != nil {
		t.Fatalf("want 3 sessions and no cursor, got %v", listed)
	}
	currentCount := 0
	var otherId string
	for _, entry := range sessions {
		view := entry.(map[string]any)
		if view["current"] == true {
			currentCount++
		} else if otherId == "" {
			otherId = view["id"].(string)
		}
	}
	if currentCount != 1 {
		t.Fatalf("exactly one session must be current: %v", sessions)
	}
	harness.expect("DELETE", "/api/v1/auth/sessions/"+otherId, second["accessToken"].(string), nil, http.StatusNoContent)
	harness.expect("DELETE", "/api/v1/auth/sessions/"+otherId, second["accessToken"].(string), nil, http.StatusNotFound)
	harness.expect("DELETE", "/api/v1/auth/sessions/not-a-uuid", second["accessToken"].(string), nil, http.StatusNotFound)
	harness.expect("DELETE", "/api/v1/auth/sessions", second["accessToken"].(string), nil, http.StatusNoContent)
	remaining := harness.expect("GET", "/api/v1/auth/sessions", second["accessToken"].(string), nil, http.StatusOK)["data"].([]any)
	if len(remaining) != 1 || remaining[0].(map[string]any)["current"] != true {
		t.Fatalf("only the current session should remain: %v", remaining)
	}
	harness.expect("POST", "/api/v1/auth/refresh", "", map[string]string{"refreshToken": first["refreshToken"].(string)}, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/auth/refresh", "", map[string]string{"refreshToken": third["refreshToken"].(string)}, http.StatusUnauthorized)
}

func TestGoogleSignInCreatesLinksAndRejectsBadTokens(t *testing.T) {
	provider := startFakeIdentityProvider(t, "https://accounts.google.com", "google-client-id")
	harness := startAuthModuleAgainstFreshSchema(t, func(settings *configs.AuthSettings) {
		settings.GoogleClientIds = []string{"google-client-id"}
		settings.GoogleJwksUrl = provider.jwksUrl
	})
	nonce := "0123456789abcdef0123456789abcdef"
	token := provider.signToken(t, "google-subject-1", "Grace@Example.com", true, nonce)
	created := harness.expect("POST", "/api/v1/auth/google", "", map[string]string{"idToken": token, "nonce": nonce}, http.StatusCreated)
	user := created["user"].(map[string]any)
	if created["isNewUser"] != true || user["email"] != "grace@example.com" || user["emailVerified"] != true || user["hasPassword"] != false {
		t.Fatalf("unexpected social registration %v", created)
	}
	again := harness.expect("POST", "/api/v1/auth/google", "", map[string]string{"idToken": token, "nonce": nonce}, http.StatusOK)
	if again["isNewUser"] != false || again["user"].(map[string]any)["id"] != user["id"] {
		t.Fatalf("second sign-in must reuse the account: %v", again)
	}

	for name, body := range map[string]map[string]string{
		"wrong nonce":     {"idToken": token, "nonce": "ffffffffffffffffffffffffffffffff"},
		"tampered token":  {"idToken": token + "x", "nonce": nonce},
		"garbage token":   {"idToken": "aaaaaaaaaa.bbbbbbbbbbbb.cccccccccccc", "nonce": nonce},
		"unverified mail": {"idToken": provider.signToken(t, "google-subject-2", "other@example.com", false, nonce), "nonce": nonce},
	} {
		status, _ := harness.call("POST", "/api/v1/auth/google", "", body)
		if status < 400 || status >= 500 {
			t.Errorf("%s: status %d, want 4xx", name, status)
		}
	}
	wrongAudience := startFakeIdentityProvider(t, "https://accounts.google.com", "someone-elses-client")
	status, _ := harness.call("POST", "/api/v1/auth/google", "", map[string]string{"idToken": wrongAudience.signToken(t, "s", "x@example.com", true, nonce), "nonce": nonce})
	if status != http.StatusUnauthorized {
		t.Errorf("foreign key and audience must be rejected, got %d", status)
	}
}

func TestSocialSignInLinksToExistingVerifiedEmailAndReportsNotConfigured(t *testing.T) {
	provider := startFakeIdentityProvider(t, "https://appleid.apple.com", "app.zudomart.ios")
	harness := startAuthModuleAgainstFreshSchema(t, func(settings *configs.AuthSettings) {
		settings.AppleClientIds = []string{"app.zudomart.ios"}
		settings.AppleJwksUrl = provider.jwksUrl
	})
	registered := harness.registerAccountAndLogIn("linked@example.com", "linkedpass1")
	rawNonce := "abcdefabcdefabcdefabcdefabcdefab"
	hashed := sha256Hex(rawNonce)
	token := provider.signToken(t, "apple-subject", "linked@example.com", "true", hashed)
	linked := harness.expect("POST", "/api/v1/auth/apple", "", map[string]any{"identityToken": token, "nonce": rawNonce, "fullName": map[string]any{"givenName": "Ada", "familyName": nil}}, http.StatusOK)
	if linked["user"].(map[string]any)["id"] != registered["user"].(map[string]any)["id"] || linked["isNewUser"] != false {
		t.Fatalf("apple identity must link to the existing account: %v", linked)
	}
	notConfigured := harness.expect("POST", "/api/v1/auth/google", "", map[string]string{"idToken": token, "nonce": rawNonce}, http.StatusServiceUnavailable)
	if notConfigured["code"] != "SOCIAL_SIGN_IN_NOT_CONFIGURED" {
		t.Fatalf("unexpected %v", notConfigured)
	}
}

func sha256Hex(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func TestUsernameAvailabilityExplainsWhyAndRegistrationEnforcesIt(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	cases := map[string]string{"g00gle": "reserved", "official.admin": "reserved", "ab": "invalid", "_._": "invalid", "fresh.name": ""}
	for username, wantReason := range cases {
		result := harness.expect("GET", "/api/v1/auth/username-available?username="+username, "", nil, http.StatusOK)
		reason, _ := result["reason"].(string)
		if reason != wantReason || result["available"] != (wantReason == "") {
			t.Errorf("%q: got %v, want reason %q", username, result, wantReason)
		}
	}
	email := "reserved.try@example.com"
	harness.expect("POST", "/api/v1/auth/otp/send", "", map[string]string{"destination": email, "purpose": "signup"}, http.StatusOK)
	otpToken := harness.expect("POST", "/api/v1/auth/otp/verify", "", map[string]string{"destination": email, "code": harness.lastLoggedOneTimeCode(), "purpose": "signup"}, http.StatusOK)["otpToken"].(string)
	rejected := harness.expect("POST", "/api/v1/auth/register", "", map[string]string{"email": email, "birthday": "1990-01-01", "password": "reservedpass1", "username": "paypa1", "otpToken": otpToken}, http.StatusUnprocessableEntity)
	if rejected["code"] != "USERNAME_UNAVAILABLE" {
		t.Fatalf("unexpected %v", rejected)
	}
}
