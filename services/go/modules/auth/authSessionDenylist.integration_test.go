package auth

import (
	"context"
	"net/http"
	"os"
	"testing"

	"github.com/google/uuid"

	"zudomart/platform/identityports"
	"zudomart/platform/jwtauth"
)

func registerValkeyDenylistForTest(t *testing.T) {
	t.Helper()
	rawUrl := os.Getenv("AUTH_TEST_VALKEY_URL")
	if rawUrl == "" {
		rawUrl = "redis://localhost:16379/15"
	}
	denylist, err := jwtauth.NewRedisSessionDenylistFromUrl(rawUrl)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := denylist.IsSessionRevoked(context.Background(), "probe"); err != nil {
		_ = denylist.Close()
		t.Skipf("valkey not reachable (run pnpm backend:up): %v", err)
	}
	jwtauth.RegisterSessionDenylist(denylist)
	t.Cleanup(func() { jwtauth.RegisterSessionDenylist(nil); _ = denylist.Close() })
}

func TestPreRevocationAccessTokensAreRejectedAfterLogoutRevokeOthersAndBan(t *testing.T) {
	registerValkeyDenylistForTest(t)
	harness := startAuthModuleAgainstFreshSchema(t)
	email := "revoked.tokens@example.com"
	registered := harness.registerAccountAndLogIn(email, "firstpass1")
	accountId := uuid.MustParse(registered["user"].(map[string]any)["id"].(string))
	logIn := func() string {
		return harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "firstpass1"}, http.StatusOK)["accessToken"].(string)
	}
	loggedOut, kept, revokedByOther := registered["accessToken"].(string), logIn(), logIn()

	harness.expect("GET", "/api/v1/auth/sessions", loggedOut, nil, http.StatusOK)
	harness.expect("POST", "/api/v1/auth/logout", loggedOut, nil, http.StatusNoContent)
	harness.expect("GET", "/api/v1/auth/sessions", loggedOut, nil, http.StatusUnauthorized)
	harness.expect("GET", "/api/v1/auth/sessions", kept, nil, http.StatusOK)

	harness.expect("DELETE", "/api/v1/auth/sessions", kept, nil, http.StatusNoContent)
	harness.expect("GET", "/api/v1/auth/sessions", revokedByOther, nil, http.StatusUnauthorized)
	harness.expect("GET", "/api/v1/auth/sessions", kept, nil, http.StatusOK)

	if err := harness.enforcement().BanAccountAndRevokeSessions(context.Background(), accountId, identityports.BanDetails{Reason: "fraud", BlockedBy: "staff-1"}); err != nil {
		t.Fatal(err)
	}
	harness.expect("GET", "/api/v1/auth/sessions", kept, nil, http.StatusUnauthorized)
}

func TestPasswordChangeRejectsOtherSessionsAccessTokens(t *testing.T) {
	registerValkeyDenylistForTest(t)
	harness := startAuthModuleAgainstFreshSchema(t)
	email := "password.change@example.com"
	current := harness.registerAccountAndLogIn(email, "firstpass1")["accessToken"].(string)
	stolen := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "firstpass1"}, http.StatusOK)["accessToken"].(string)

	harness.expect("POST", "/api/v1/auth/password/change", current, map[string]string{"currentPassword": "firstpass1", "newPassword": "changed4pass"}, http.StatusNoContent)
	harness.expect("GET", "/api/v1/auth/sessions", stolen, nil, http.StatusUnauthorized)
	harness.expect("GET", "/api/v1/auth/sessions", current, nil, http.StatusOK)
}
