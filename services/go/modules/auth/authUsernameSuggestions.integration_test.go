package auth

import (
	"net/http"
	"net/url"
	"testing"

	"nantty/platform/usernames"
)

func (harness *authTestHarness) registerWithUsername(email, username string, wantStatus int) map[string]any {
	harness.t.Helper()
	harness.expect("POST", "/api/v1/auth/otp/send", "", map[string]string{"destination": email, "purpose": "signup"}, http.StatusOK)
	otpToken := harness.expect("POST", "/api/v1/auth/otp/verify", "", map[string]string{"destination": email, "code": harness.lastLoggedOneTimeCode(), "purpose": "signup"}, http.StatusOK)["otpToken"].(string)
	return harness.expect("POST", "/api/v1/auth/register", "", map[string]string{"email": email, "birthday": "1990-01-01", "password": "analytical1", "username": username, "name": "Taken Name", "otpToken": otpToken}, wantStatus)
}

func assertValidSuggestions(t *testing.T, body map[string]any, taken string) {
	t.Helper()
	raw, _ := body["suggestions"].([]any)
	if len(raw) != 3 {
		t.Fatalf("want 3 suggestions, got %v", body)
	}
	seen := map[string]bool{}
	for _, item := range raw {
		suggestion := item.(string)
		if suggestion == taken || seen[suggestion] || !usernames.HasValidFormat(suggestion) {
			t.Fatalf("bad suggestion %q in %v", suggestion, body)
		}
		seen[suggestion] = true
	}
}

func TestTakenUsernameReturnsSuggestionsFromAvailabilityAndRegister(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	registered := harness.registerWithUsername("first@example.com", "sunny.day", http.StatusCreated)
	accessToken := registered["accessToken"].(string)

	query := "/api/v1/auth/username-available?name=" + url.QueryEscape("Sunny Day") + "&username="
	anonymous := harness.expect("GET", query+"sunny.day", "", nil, http.StatusOK)
	if anonymous["available"] != false || anonymous["reason"] != "unavailable" || anonymous["suggestions"] != nil {
		t.Fatalf("anonymous availability must not reveal why or suggest names: %v", anonymous)
	}
	taken := harness.expect("GET", query+"sunny.day", accessToken, nil, http.StatusOK)
	if taken["available"] != false || taken["reason"] != "taken" {
		t.Fatalf("expected taken, got %v", taken)
	}
	assertValidSuggestions(t, taken, "sunny.day")

	free := harness.expect("GET", query+"sunny.free", accessToken, nil, http.StatusOK)
	if free["available"] != true || free["suggestions"] != nil {
		t.Fatalf("free username must not carry suggestions: %v", free)
	}
	if invalid := harness.expect("GET", query+"a", accessToken, nil, http.StatusOK); invalid["suggestions"] != nil {
		t.Fatalf("invalid username must not carry suggestions: %v", invalid)
	}

	conflict := harness.registerWithUsername("second@example.com", "sunny.day", http.StatusConflict)
	if conflict["code"] != "USERNAME_TAKEN" {
		t.Fatalf("unexpected conflict %v", conflict)
	}
	assertValidSuggestions(t, conflict, "sunny.day")
}
