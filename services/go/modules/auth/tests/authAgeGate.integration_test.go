package auth_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"nantty/modules/auth/src/configs"
	"nantty/platform/postgres"
)

func (harness *authTestHarness) verifiedSignupToken(email string) string {
	harness.t.Helper()
	harness.expect("POST", "/api/v1/auth/otp/send", "", map[string]string{"destination": email, "purpose": "signup"}, http.StatusOK)
	return harness.expect("POST", "/api/v1/auth/otp/verify", "", map[string]string{"destination": email, "code": harness.lastLoggedOneTimeCode(), "purpose": "signup"}, http.StatusOK)["otpToken"].(string)
}

func (harness *authTestHarness) callFromDevice(method, path, deviceId string, body any) (int, map[string]any) {
	harness.t.Helper()
	encoded, _ := json.Marshal(body)
	request, _ := http.NewRequest(method, harness.server.URL+path, bytes.NewReader(encoded))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Device-Id", deviceId)
	request.Header.Set("X-Forwarded-For", harness.clientIp)
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		harness.t.Fatal(err)
	}
	defer response.Body.Close()
	decoded := map[string]any{}
	_ = json.NewDecoder(response.Body).Decode(&decoded)
	return response.StatusCode, decoded
}

func (harness *authTestHarness) queryRow(statement string, destinations ...any) {
	harness.queryRowWithArgs(statement, nil, destinations...)
}

func (harness *authTestHarness) queryRowWithArgs(statement string, arguments []any, destinations ...any) {
	harness.t.Helper()
	scoped, err := postgres.ScopeDatabaseUrlToSchema(harness.settings.DatabaseUrl, harness.settings.DatabaseSchema)
	if err != nil {
		harness.t.Fatal(err)
	}
	database, err := postgres.OpenDatabaseAndVerifyConnection(context.Background(), scoped, postgres.DefaultPoolSettings())
	if err != nil {
		harness.t.Fatal(err)
	}
	defer database.Close()
	if err := database.QueryRow(statement, arguments...).Scan(destinations...); err != nil {
		harness.t.Fatal(err)
	}
}

func birthdayYearsAgo(years int, days int) string {
	now := time.Now().UTC()
	return time.Date(now.Year()-years, now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, days).Format(time.DateOnly)
}

func TestUnderThirteenSignupIsRefusedWithoutStoringTheBirthdayAndRetriesAreBlocked(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	email := "young.one@example.com"
	token := harness.verifiedSignupToken(email)
	status, body := harness.callFromDevice("POST", "/api/v1/auth/register", "device-child-0001", map[string]string{"email": email, "birthday": birthdayYearsAgo(13, 1), "password": "younger12345", "otpToken": token})
	if status != http.StatusForbidden || body["code"] != "BELOW_MINIMUM_AGE" || !strings.Contains(body["message"].(string), "13") {
		t.Fatalf("12 years and 364 days must be refused kindly: %d %v", status, body)
	}
	var accounts, refusals int
	harness.queryRow("SELECT count(*) FROM accounts", &accounts)
	harness.queryRow("SELECT count(*) FROM age_gate_refusals WHERE expires_at > now()", &refusals)
	if accounts != 0 || refusals != 2 {
		t.Fatalf("no account and only hashed email+device refusals must exist: accounts=%d refusals=%d", accounts, refusals)
	}
	var leaked int
	harness.queryRow("SELECT count(*) FROM age_gate_refusals WHERE value_hash LIKE '%young%' OR value_hash LIKE '%device-child%'", &leaked)
	if leaked != 0 {
		t.Fatal("refusals must store hashes only")
	}
	retry := harness.verifiedSignupToken(email)
	status, body = harness.callFromDevice("POST", "/api/v1/auth/register", "device-other-0002", map[string]string{"email": email, "birthday": "1990-01-01", "password": "younger12345", "otpToken": retry})
	if status != http.StatusForbidden || body["code"] != "BELOW_MINIMUM_AGE" {
		t.Fatalf("editing the birthday right after a refusal must not bypass the gate: %d %v", status, body)
	}
	other := "someone.else@example.com"
	status, body = harness.callFromDevice("POST", "/api/v1/auth/register", "device-child-0001", map[string]string{"email": other, "birthday": "1990-01-01", "password": "younger12345", "otpToken": harness.verifiedSignupToken(other)})
	if status != http.StatusForbidden {
		t.Fatalf("the same device is refused for a day: %d %v", status, body)
	}
	harness.execSql("UPDATE age_gate_refusals SET expires_at = now() - interval '1 minute'")
	status, _ = harness.callFromDevice("POST", "/api/v1/auth/register", "device-other-0003", map[string]string{"email": other, "birthday": "1990-01-01", "password": "younger12345", "otpToken": harness.verifiedSignupToken(other)})
	if status != http.StatusCreated {
		t.Fatalf("expired refusals stop blocking: %d", status)
	}
}

func TestBirthdayEdgeCasesAtSignup(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	cases := []struct {
		name     string
		birthday string
		status   int
	}{
		{"thirteen today", birthdayYearsAgo(13, 0), http.StatusCreated},
		{"future date", time.Now().UTC().AddDate(0, 0, 2).Format(time.DateOnly), http.StatusUnprocessableEntity},
		{"absurd age", "1850-01-01", http.StatusUnprocessableEntity},
		{"wrong format", "01/02/1990", http.StatusBadRequest},
		{"seventeen", birthdayYearsAgo(17, 0), http.StatusCreated},
	}
	for index, testCase := range cases {
		email := "edge" + string(rune('a'+index)) + "@example.com"
		status, body := harness.callFromDevice("POST", "/api/v1/auth/register", "device-edge-000"+string(rune('a'+index)), map[string]string{"email": email, "birthday": testCase.birthday, "password": "edgecase123", "otpToken": harness.verifiedSignupToken(email)})
		if status != testCase.status && !(testCase.status == http.StatusBadRequest && status == http.StatusUnprocessableEntity) {
			t.Errorf("%s: got %d %v want %d", testCase.name, status, body, testCase.status)
		}
	}
}

func TestSocialSignupUnderThirteenIsRefusedAndExistingAccountsCanAddABirthdayOnce(t *testing.T) {
	provider := startFakeIdentityProvider(t, "https://accounts.google.com", "google-client-id")
	harness := startAuthModuleAgainstFreshSchema(t, func(settings *configs.AuthSettings) {
		settings.GoogleClientIds = []string{"google-client-id"}
		settings.GoogleJwksUrl = provider.jwksUrl
	})
	nonce := "0123456789abcdef0123456789abcdef"
	childToken := provider.signToken(t, "google-child", "child@example.com", true, nonce)
	refused := harness.expect("POST", "/api/v1/auth/google", "", map[string]string{"idToken": childToken, "nonce": nonce, "birthday": birthdayYearsAgo(12, 0)}, http.StatusForbidden)
	if refused["code"] != "BELOW_MINIMUM_AGE" {
		t.Fatalf("unexpected %v", refused)
	}
	harness.expect("POST", "/api/v1/auth/google", "", map[string]string{"idToken": childToken, "nonce": nonce, "birthday": "1990-01-01"}, http.StatusForbidden)

	legacy := harness.registerAccountAndLogIn("legacy@example.com", "legacypass1")
	harness.execSql("UPDATE accounts SET birthday = NULL WHERE email = 'legacy@example.com'")
	accessToken := legacy["accessToken"].(string)
	harness.expect("PUT", "/api/v1/auth/account/birthday", "", map[string]string{"birthday": "1990-01-01"}, http.StatusUnauthorized)
	added := harness.expect("PUT", "/api/v1/auth/account/birthday", accessToken, map[string]string{"birthday": birthdayYearsAgo(15, 0)}, http.StatusOK)
	if added["ageBracket"] != "minor" {
		t.Fatalf("a 15 year old is a minor: %v", added)
	}
	again := harness.expect("PUT", "/api/v1/auth/account/birthday", accessToken, map[string]string{"birthday": "1980-01-01"}, http.StatusConflict)
	if again["code"] != "BIRTHDAY_ALREADY_SET" {
		t.Fatalf("a birthday cannot be changed by the user: %v", again)
	}
	var bracket string
	harness.queryRow("SELECT account_age_bracket(id) FROM accounts WHERE email = 'legacy@example.com'", &bracket)
	if bracket != "minor" {
		t.Fatalf("other services read only the bracket: %q", bracket)
	}

	young := harness.registerAccountAndLogIn("young.legacy@example.com", "legacypass2")
	harness.execSql("UPDATE accounts SET birthday = NULL WHERE email = 'young.legacy@example.com'")
	suspended := harness.expect("PUT", "/api/v1/auth/account/birthday", young["accessToken"].(string), map[string]string{"birthday": birthdayYearsAgo(11, 0)}, http.StatusForbidden)
	if suspended["code"] != "BELOW_MINIMUM_AGE" {
		t.Fatalf("unexpected %v", suspended)
	}
	var status string
	var birthdayStored bool
	harness.queryRow("SELECT status, birthday IS NOT NULL FROM accounts WHERE email = 'young.legacy@example.com'", &status, &birthdayStored)
	if status != "suspended" || birthdayStored {
		t.Fatalf("an under-13 existing account is suspended for review without storing the birthday: %s %v", status, birthdayStored)
	}
}
