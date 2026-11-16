package auth_test

import (
	"net/http"
	"testing"
)

func TestRepeatedWrongPasswordsLockTheIdentifierButNotOtherAccounts(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	harness.registerAccountAndLogIn("lockout.target@example.com", "correct-horse1")
	harness.registerAccountAndLogIn("lockout.bystander@example.com", "correct-horse1")
	for attempt := 0; attempt < 10; attempt++ {
		harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": "lockout.target@example.com", "password": "guess-number" + string(rune('a'+attempt))}, http.StatusUnauthorized)
	}
	locked := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": "LOCKOUT.target@example.com", "password": "correct-horse1"}, http.StatusTooManyRequests)
	if locked["code"] != "TOO_MANY_LOGIN_ATTEMPTS" {
		t.Fatalf("expected a lockout, got %v", locked)
	}
	harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": "lockout.bystander@example.com", "password": "correct-horse1"}, http.StatusOK)
	harness.clientIp = "203.0.113.77"
	for attempt := 0; attempt < 10; attempt++ {
		harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": "nobody.here@example.com", "password": "guess-number1"}, http.StatusUnauthorized)
	}
	missing := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": "nobody.here@example.com", "password": "guess-number1"}, http.StatusTooManyRequests)
	if missing["code"] != "TOO_MANY_LOGIN_ATTEMPTS" {
		t.Fatalf("unknown identifiers must lock the same way so the lockout reveals nothing, got %v", missing)
	}
}
