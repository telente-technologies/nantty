package auth_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"nantty/platform/jwtauth"
	"nantty/platform/postgres"
)

func refillAuthRateLimitAroundTest(t *testing.T) {
	time.Sleep(2 * time.Second)
	t.Cleanup(func() { time.Sleep(2 * time.Second) })
}

func registerForStepUp(t *testing.T, harness *authTestHarness, email string) map[string]any {
	t.Helper()
	harness.expect("POST", "/api/v1/auth/otp/send", "", map[string]string{"destination": email, "purpose": "signup"}, http.StatusOK)
	otpToken := harness.expect("POST", "/api/v1/auth/otp/verify", "", map[string]string{"destination": email, "code": harness.lastLoggedOneTimeCode(), "purpose": "signup"}, http.StatusOK)["otpToken"].(string)
	return harness.expect("POST", "/api/v1/auth/register", "", map[string]string{"email": email, "birthday": "1994-01-02", "password": "withdraw-safe1", "otpToken": otpToken}, http.StatusCreated)
}

func verifyStepUpForRequest(t *testing.T, harness *authTestHarness, accessToken, stepUpToken string) bool {
	t.Helper()
	verifier, err := jwtauth.NewAccessTokenVerifierFromRemoteJwks(context.Background(), harness.server.URL+"/.well-known/jwks.json", harness.settings.TokenIssuer, harness.settings.TokenAudience)
	if err != nil {
		t.Fatal(err)
	}
	principal, err := verifier.VerifyAccessTokenAndExtractPrincipal(context.Background(), accessToken)
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/", nil)
	request.Header.Set(jwtauth.UserStepUpHeader, stepUpToken)
	return jwtauth.VerifyUserStepUp(context.Background(), verifier, request, principal)
}

func TestStepUpWithPasswordIsBoundToTheSessionAndAudience(t *testing.T) {
	refillAuthRateLimitAroundTest(t)
	harness := startAuthModuleAgainstFreshSchema(t)
	registered := registerForStepUp(t, harness, "stepup@example.com")
	access := registered["accessToken"].(string)

	harness.expect("POST", "/api/v1/auth/step-up", "", map[string]string{"password": "withdraw-safe1"}, http.StatusUnauthorized)
	if body := harness.expect("POST", "/api/v1/auth/step-up", access, map[string]string{}, http.StatusBadRequest); body["code"] != "STEP_UP_PROOF_REQUIRED" {
		t.Fatalf("missing proof: %v", body)
	}
	if body := harness.expect("POST", "/api/v1/auth/step-up", access, map[string]string{"password": "wrong-password1"}, http.StatusUnauthorized); body["code"] != "STEP_UP_FAILED" {
		t.Fatalf("wrong password: %v", body)
	}
	harness.expect("POST", "/api/v1/auth/step-up", access, map[string]any{"password": "withdraw-safe1", "extra": true}, http.StatusBadRequest)
	granted := harness.expect("POST", "/api/v1/auth/step-up", access, map[string]string{"password": "withdraw-safe1"}, http.StatusOK)
	stepUp := granted["stepUpToken"].(string)
	if granted["expiresIn"].(float64) != 300 || granted["method"] != "password" {
		t.Fatalf("unexpected grant %v", granted)
	}
	if !verifyStepUpForRequest(t, harness, access, stepUp) {
		t.Fatal("step-up token must verify for its own session")
	}
	if verifyStepUpForRequest(t, harness, access, access) {
		t.Fatal("an access token must not pass as a step-up token")
	}
	other := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": "stepup@example.com", "password": "withdraw-safe1"}, http.StatusOK)
	if verifyStepUpForRequest(t, harness, other["accessToken"].(string), stepUp) {
		t.Fatal("a step-up token from another session must be rejected")
	}
	harness.expect("POST", "/api/v1/auth/logout", access, map[string]any{"refreshToken": registered["refreshToken"]}, http.StatusNoContent)
	harness.expect("POST", "/api/v1/auth/step-up", other["accessToken"].(string), map[string]string{"password": "withdraw-safe1"}, http.StatusOK)
}

func TestStepUpWithoutPasswordNeedsAnEmailedCodeForTheOwnAddress(t *testing.T) {
	refillAuthRateLimitAroundTest(t)
	harness := startAuthModuleAgainstFreshSchema(t)
	registered := registerForStepUp(t, harness, "nopass@example.com")
	registerForStepUp(t, harness, "someone@example.com")
	access := registered["accessToken"].(string)
	database, err := postgres.OpenDatabaseAndVerifyConnection(context.Background(), harness.settings.DatabaseUrl, postgres.DefaultPoolSettings())
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	if _, err := database.Exec("UPDATE " + pgx.Identifier{harness.settings.DatabaseSchema, "accounts"}.Sanitize() + " SET password_hash = NULL WHERE email = 'nopass@example.com'"); err != nil {
		t.Fatal(err)
	}
	harness.expect("POST", "/api/v1/auth/step-up", access, map[string]string{"password": "withdraw-safe1"}, http.StatusBadRequest)

	harness.expect("POST", "/api/v1/auth/otp/send", "", map[string]string{"destination": "someone@example.com", "purpose": "login"}, http.StatusOK)
	foreign := harness.expect("POST", "/api/v1/auth/otp/verify", "", map[string]string{"destination": "someone@example.com", "code": harness.lastLoggedOneTimeCode(), "purpose": "login"}, http.StatusOK)["otpToken"].(string)
	harness.expect("POST", "/api/v1/auth/step-up", access, map[string]string{"otpToken": foreign}, http.StatusUnauthorized)

	harness.expect("POST", "/api/v1/auth/otp/send", "", map[string]string{"destination": "nopass@example.com", "purpose": "login"}, http.StatusOK)
	own := harness.expect("POST", "/api/v1/auth/otp/verify", "", map[string]string{"destination": "nopass@example.com", "code": harness.lastLoggedOneTimeCode(), "purpose": "login"}, http.StatusOK)["otpToken"].(string)
	granted := harness.expect("POST", "/api/v1/auth/step-up", access, map[string]string{"otpToken": own}, http.StatusOK)
	if granted["method"] != "emailCode" || !verifyStepUpForRequest(t, harness, access, granted["stepUpToken"].(string)) {
		t.Fatalf("unexpected grant %v", granted)
	}
	harness.expect("POST", "/api/v1/auth/step-up", access, map[string]string{"otpToken": own}, http.StatusUnauthorized)
}
