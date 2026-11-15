package admin_test

import (
	"net/http"
	"testing"
)

const adminPassword = "Ops-Passphrase-92-xyz"

func TestSuperadminEnrollsMfaSteppingUpInvitesAdminAndAdminCannotInvite(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	harness.bootstrapSuperadmin("Root@Nantty.com")

	harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "root@nantty.com", "password": "wrong-password-1"}, nil, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "nobody@nantty.com", "password": strongPassword}, nil, http.StatusUnauthorized)
	loginChallenge := harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "root@nantty.com", "password": strongPassword}, nil, http.StatusOK)
	harness.expect("POST", "/api/v1/admin/auth/mfa/verify", map[string]string{"challengeToken": loginChallenge["challengeToken"].(string), "code": "123456"}, nil, http.StatusUnauthorized)

	session, secret := harness.enrollAndSignIn("root@nantty.com", strongPassword)
	staff := session["staff"].(map[string]any)
	if staff["role"] != "SUPERADMIN" || staff["mfaEnrolled"] != true || session["tokenType"] != "Bearer" {
		t.Fatalf("unexpected session %v", session)
	}
	superadminId := staff["id"].(string)
	harness.expect("GET", "/api/v1/admin/auth/me", nil, nil, http.StatusUnauthorized)
	harness.expect("GET", "/api/v1/admin/auth/me", nil, bearer(session["accessToken"].(string)), http.StatusOK)
	harness.expect("GET", "/api/v1/admin/auth/me", nil, bearer(harness.fakeToken.SignAccountAccessToken(t, "11111111-1111-1111-1111-111111111111")), http.StatusUnauthorized)

	replay := harness.call("POST", "/api/v1/admin/auth/login", map[string]string{"email": "root@nantty.com", "password": strongPassword}, nil)
	harness.expect("POST", "/api/v1/admin/auth/mfa/verify", map[string]string{"challengeToken": replay.body["challengeToken"].(string), "code": codeForStepOffset(t, secret, -1)}, nil, http.StatusUnauthorized)
	accessToken := harness.signInWithMfa("root@nantty.com", strongPassword, secret, 0)["accessToken"].(string)

	invitation := map[string]any{"email": "Ops@Nantty.com", "name": "Ops", "role": "ADMIN", "permissions": []string{"audit:read"}, "reason": "new operations hire"}
	denied := harness.expect("POST", "/api/v1/admin/admins", invitation, bearer(accessToken), http.StatusForbidden)
	if denied["code"] != "STEP_UP_REQUIRED" {
		t.Fatalf("unexpected %v", denied)
	}
	harness.expect("POST", "/api/v1/admin/auth/step-up", map[string]string{"code": "000000"}, bearer(accessToken), http.StatusUnauthorized)
	withStepUp := bearerWithStepUp(accessToken, harness.grantStepUp(accessToken, secret, 1))
	harness.expect("POST", "/api/v1/admin/admins", map[string]any{"email": "x@nantty.com", "role": "ADMIN", "permissions": []string{"BAD PERMISSION"}, "reason": "bad permission"}, withStepUp, http.StatusBadRequest)
	created := harness.expect("POST", "/api/v1/admin/admins", invitation, withStepUp, http.StatusCreated)
	invited := created["admin"].(map[string]any)
	if invited["email"] != "ops@nantty.com" || invited["role"] != "ADMIN" || invited["status"] != "INVITED" || created["invitationSentTo"] != "ops@nantty.com" {
		t.Fatalf("unexpected invitation %v", created)
	}
	harness.expect("POST", "/api/v1/admin/admins", invitation, withStepUp, http.StatusConflict)
	harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "ops@nantty.com", "password": adminPassword}, nil, http.StatusUnauthorized)

	invitationToken := harness.lastLoggedInvitationToken()
	harness.expect("POST", "/api/v1/admin/auth/accept-invitation", map[string]string{"token": invitationToken, "password": "short1"}, nil, http.StatusBadRequest)
	harness.expect("POST", "/api/v1/admin/auth/accept-invitation", map[string]string{"token": invitationToken, "password": adminPassword}, nil, http.StatusNoContent)
	harness.expect("POST", "/api/v1/admin/auth/accept-invitation", map[string]string{"token": invitationToken, "password": adminPassword}, nil, http.StatusBadRequest)

	adminSession, adminSecret := harness.enrollAndSignIn("ops@nantty.com", adminPassword)
	adminToken := adminSession["accessToken"].(string)
	adminId := adminSession["staff"].(map[string]any)["id"].(string)
	harness.expect("GET", "/api/v1/admin/admins", nil, bearer(adminToken), http.StatusForbidden)
	adminStepUp := bearerWithStepUp(adminToken, harness.grantStepUp(adminToken, adminSecret, 1))
	harness.expect("POST", "/api/v1/admin/admins", map[string]any{"email": "third@nantty.com", "role": "ADMIN", "permissions": []string{}, "reason": "no staff permission"}, adminStepUp, http.StatusForbidden)

	permissions := map[string]any{"role": "ADMIN", "permissions": []string{"audit:read", "staff:manage"}, "reason": "needs staff access"}
	harness.expect("PUT", "/api/v1/admin/admins/"+adminId+"/permissions", permissions, bearer(accessToken), http.StatusForbidden)
	harness.expect("PUT", "/api/v1/admin/admins/"+adminId+"/permissions", permissions, withStepUp, http.StatusOK)
	harness.expect("PUT", "/api/v1/admin/admins/"+superadminId+"/permissions", permissions, withStepUp, http.StatusConflict)
	reason := map[string]string{"reason": "testing the guard"}
	harness.expect("POST", "/api/v1/admin/admins/"+superadminId+"/disable", reason, withStepUp, http.StatusConflict)
	harness.expect("POST", "/api/v1/admin/auth/refresh", map[string]string{"refreshToken": adminSession["refreshToken"].(string)}, nil, http.StatusUnauthorized)
	harness.expect("GET", "/api/v1/admin/auth/me", nil, bearer(adminToken), http.StatusUnauthorized)
	waitForNextTotpStep()
	refreshed := harness.signInWithMfa("ops@nantty.com", adminPassword, adminSecret, 1)
	listed := harness.expect("GET", "/api/v1/admin/admins", nil, bearer(refreshed["accessToken"].(string)), http.StatusOK)
	if len(listed["data"].([]any)) != 2 || listed["nextCursor"] != nil {
		t.Fatalf("unexpected staff list %v", listed)
	}

	disabled := harness.expect("POST", "/api/v1/admin/admins/"+adminId+"/disable", map[string]string{"reason": "left the company"}, withStepUp, http.StatusOK)
	if disabled["admin"].(map[string]any)["status"] != "DISABLED" {
		t.Fatalf("unexpected %v", disabled)
	}
	harness.expect("POST", "/api/v1/admin/auth/refresh", map[string]string{"refreshToken": refreshed["refreshToken"].(string)}, nil, http.StatusUnauthorized)
	harness.expect("GET", "/api/v1/admin/auth/me", nil, bearer(refreshed["accessToken"].(string)), http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "ops@nantty.com", "password": adminPassword}, nil, http.StatusUnauthorized)
	waitForEventTypes(t, harness, "staff.invited")
}

func TestRefreshRotationReuseDetectionAndLogout(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	harness.bootstrapSuperadmin("rotator@nantty.com")
	session, secret := harness.enrollAndSignIn("rotator@nantty.com", strongPassword)
	first := session["refreshToken"].(string)
	rotated := harness.expect("POST", "/api/v1/admin/auth/refresh", map[string]string{"refreshToken": first}, nil, http.StatusOK)
	if rotated["refreshToken"] == first {
		t.Fatal("refresh token must rotate")
	}
	reuse := harness.expect("POST", "/api/v1/admin/auth/refresh", map[string]string{"refreshToken": first}, nil, http.StatusUnauthorized)
	if reuse["code"] != "REFRESH_TOKEN_REUSED" {
		t.Fatalf("expected reuse detection, got %v", reuse)
	}
	harness.expect("POST", "/api/v1/admin/auth/refresh", map[string]string{"refreshToken": rotated["refreshToken"].(string)}, nil, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/admin/auth/refresh", map[string]string{"refreshToken": "not-a-real-refresh-token-0000"}, nil, http.StatusUnauthorized)

	fresh := harness.signInWithMfa("rotator@nantty.com", strongPassword, secret, 0)
	token := fresh["accessToken"].(string)
	harness.expect("POST", "/api/v1/admin/auth/logout", nil, bearer(token), http.StatusNoContent)
	harness.expect("GET", "/api/v1/admin/auth/me", nil, bearer(token), http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/admin/auth/refresh", map[string]string{"refreshToken": fresh["refreshToken"].(string)}, nil, http.StatusUnauthorized)
}

func TestFiveWrongPasswordsLockTheAccountWithoutRevealingIt(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	harness.bootstrapSuperadmin("locked@nantty.com")
	for attempt := 1; attempt <= 5; attempt++ {
		result := harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "locked@nantty.com", "password": "definitely-wrong-1"}, nil, http.StatusUnauthorized)
		if result["code"] != "INVALID_CREDENTIALS" {
			t.Fatalf("attempt %d: %v", attempt, result)
		}
	}
	locked := harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "locked@nantty.com", "password": strongPassword}, nil, http.StatusUnauthorized)
	unknown := harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "ghost@nantty.com", "password": strongPassword}, nil, http.StatusUnauthorized)
	if locked["code"] != unknown["code"] || locked["message"] != unknown["message"] {
		t.Fatalf("locked and unknown accounts must look the same: %v vs %v", locked, unknown)
	}
}

func TestLoginRateLimitReturns429PerEmail(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	limited := 0
	for attempt := 0; attempt < 14; attempt++ {
		if harness.call("POST", "/api/v1/admin/auth/login", map[string]string{"email": "spray@nantty.com", "password": "whatever-pass-1"}, nil).status == http.StatusTooManyRequests {
			limited++
		}
	}
	if limited == 0 {
		t.Fatal("expected the limiter to refuse some attempts")
	}
	harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "other@nantty.com", "password": "whatever-pass-1"}, nil, http.StatusUnauthorized)
}
