package auth

import (
	"context"
	"net/http"
	"slices"
	"sync"
	"testing"

	"zudomart/platform/identityports"
	"zudomart/platform/postgres"
)

type recordingSecurityAudit struct {
	mutex   sync.Mutex
	actions []string
}

func (recorder *recordingSecurityAudit) RecordAuditEvent(_ context.Context, event identityports.AuditEvent) error {
	recorder.mutex.Lock()
	defer recorder.mutex.Unlock()
	recorder.actions = append(recorder.actions, event.Action+":"+event.ActorRole)
	return nil
}

func (recorder *recordingSecurityAudit) has(action string) bool {
	recorder.mutex.Lock()
	defer recorder.mutex.Unlock()
	return slices.Contains(recorder.actions, action)
}

func (harness *authTestHarness) execSql(statement string, arguments ...any) {
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
	if _, err := database.Exec(statement, arguments...); err != nil {
		harness.t.Fatal(err)
	}
}

func TestSignedInUsersVerifyTheirEmailWithACode(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	session := harness.registerAccountAndLogIn("verify.me@example.com", "firstpass1")
	token := session["accessToken"].(string)
	harness.expect("POST", "/api/v1/users/me/email/verification", "", nil, http.StatusUnauthorized)
	if already := harness.expect("POST", "/api/v1/users/me/email/verification", token, nil, http.StatusConflict); already["code"] != "ALREADY_VERIFIED" {
		t.Fatalf("a signup-verified email needs no code: %v", already)
	}
	harness.execSql("UPDATE accounts SET email_verified_at = NULL")
	if notSent := harness.expect("POST", "/api/v1/users/me/email/verification/confirm", token, map[string]string{"code": "123456"}, http.StatusConflict); notSent["code"] != "CODE_NOT_SENT" {
		t.Fatalf("confirming without a code is refused: %v", notSent)
	}
	sent := harness.expect("POST", "/api/v1/users/me/email/verification", token, nil, http.StatusOK)
	if sent["expiresIn"] != float64(300) || sent["resendAfterSeconds"] != float64(60) {
		t.Fatalf("unexpected send result %v", sent)
	}
	code := harness.lastLoggedOneTimeCode()
	if again := harness.expect("POST", "/api/v1/users/me/email/verification", token, nil, http.StatusOK); harness.lastLoggedOneTimeCode() != code || again["resendAfterSeconds"].(float64) > 60 {
		t.Fatalf("a resend inside the cooldown keeps the same code: %v", again)
	}
	harness.expect("POST", "/api/v1/users/me/email/verification/confirm", token, map[string]string{"code": "12"}, http.StatusBadRequest)
	if wrong := harness.expect("POST", "/api/v1/users/me/email/verification/confirm", token, map[string]string{"code": wrongCodeFor(code)}, http.StatusBadRequest); wrong["code"] != "INVALID_CODE" {
		t.Fatalf("a wrong code is refused: %v", wrong)
	}
	verified := harness.expect("POST", "/api/v1/users/me/email/verification/confirm", token, map[string]string{"code": code}, http.StatusOK)
	if verified["email"] != "verify.me@example.com" || verified["emailVerified"] != true {
		t.Fatalf("unexpected confirm result %v", verified)
	}
	harness.expect("POST", "/api/v1/users/me/email/verification/confirm", token, map[string]string{"code": code}, http.StatusConflict)
	harness.execSql("UPDATE accounts SET email = NULL, email_verified_at = NULL")
	if missing := harness.expect("POST", "/api/v1/users/me/email/verification", token, nil, http.StatusUnprocessableEntity); missing["code"] != "EMAIL_MISSING" {
		t.Fatalf("an account without an email is told so: %v", missing)
	}
}

func TestPasswordAndSessionSecurityEventsReachTheAuditLog(t *testing.T) {
	recorder := &recordingSecurityAudit{}
	identityports.Default.RegisterAuditRecorder(recorder)
	harness := startAuthModuleAgainstFreshSchema(t)
	email := "audited@example.com"
	first := harness.registerAccountAndLogIn(email, "firstpass1")
	harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "firstpass1"}, http.StatusOK)
	harness.expect("DELETE", "/api/v1/auth/sessions", first["accessToken"].(string), nil, http.StatusNoContent)
	harness.expect("POST", "/api/v1/auth/password/change", first["accessToken"].(string), map[string]string{"currentPassword": "firstpass1", "newPassword": "secondpass2"}, http.StatusNoContent)
	harness.expect("POST", "/api/v1/auth/otp/send", "", map[string]string{"destination": email, "purpose": "reset"}, http.StatusOK)
	otpToken := harness.expect("POST", "/api/v1/auth/otp/verify", "", map[string]string{"destination": email, "code": harness.lastLoggedOneTimeCode(), "purpose": "reset"}, http.StatusOK)["otpToken"].(string)
	harness.expect("POST", "/api/v1/auth/password/reset", "", map[string]string{"otpToken": otpToken, "password": "thirdpass3"}, http.StatusNoContent)
	for _, action := range []string{"session.revoked_all:user", "password.changed:user", "password.reset:user"} {
		if !recorder.has(action) {
			t.Fatalf("missing audit %s in %v", action, recorder.actions)
		}
	}
}
