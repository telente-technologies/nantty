package admin

import (
	"net/http"
	"testing"
)

const adminPassword = "ops-passphrase-92-xyz"

func TestSuperadminEnrollsMfaSteppingUpInvitesAdminAndAdminCannotInvite(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	harness.bootstrapSuperadmin("Root@Zudomart.com")

	harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "root@zudomart.com", "password": "wrong-password-1"}, nil, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "nobody@zudomart.com", "password": strongPassword}, nil, http.StatusUnauthorized)
	loginChallenge := harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "root@zudomart.com", "password": strongPassword}, nil, http.StatusOK)
	harness.expect("POST", "/api/v1/admin/auth/mfa/verify", map[string]string{"challengeToken": loginChallenge["challengeToken"].(string), "code": "123456"}, nil, http.StatusUnauthorized)

	session, secret := harness.enrollAndSignIn("root@zudomart.com", strongPassword)
	staff := session["staff"].(map[string]any)
	if staff["role"] != "superadmin" || staff["mfaEnrolled"] != true || session["tokenType"] != "Bearer" {
		t.Fatalf("unexpected session %v", session)
	}
	superadminId := staff["id"].(string)
	harness.expect("GET", "/api/v1/admin/auth/me", nil, nil, http.StatusUnauthorized)
	harness.expect("GET", "/api/v1/admin/auth/me", nil, bearer(session["accessToken"].(string)), http.StatusOK)
	harness.expect("GET", "/api/v1/admin/auth/me", nil, bearer(harness.fakeToken.SignAccountAccessToken(t, "11111111-1111-1111-1111-111111111111")), http.StatusUnauthorized)

	replay := harness.call("POST", "/api/v1/admin/auth/login", map[string]string{"email": "root@zudomart.com", "password": strongPassword}, nil)
	harness.expect("POST", "/api/v1/admin/auth/mfa/verify", map[string]string{"challengeToken": replay.body["challengeToken"].(string), "code": codeForStepOffset(t, secret, -1)}, nil, http.StatusUnauthorized)
	accessToken := harness.signInWithMfa("root@zudomart.com", strongPassword, secret, 0)["accessToken"].(string)

	invitation := map[string]any{"email": "Ops@Zudomart.com", "displayName": "Ops", "permissions": []string{"admin.audit.read"}}
	denied := harness.expect("POST", "/api/v1/admin/admins", invitation, bearer(accessToken), http.StatusForbidden)
	if denied["code"] != "STEP_UP_REQUIRED" {
		t.Fatalf("unexpected %v", denied)
	}
	harness.expect("POST", "/api/v1/admin/auth/step-up", map[string]string{"code": "000000"}, bearer(accessToken), http.StatusUnauthorized)
	withStepUp := bearerWithStepUp(accessToken, harness.grantStepUp(accessToken, secret, 1))
	harness.expect("POST", "/api/v1/admin/admins", map[string]any{"email": "x@zudomart.com", "permissions": []string{"BAD PERMISSION"}}, withStepUp, http.StatusUnprocessableEntity)
	invited := harness.expect("POST", "/api/v1/admin/admins", invitation, withStepUp, http.StatusCreated)
	if invited["email"] != "ops@zudomart.com" || invited["role"] != "admin" || invited["status"] != "invited" {
		t.Fatalf("unexpected invitation %v", invited)
	}
	harness.expect("POST", "/api/v1/admin/admins", invitation, withStepUp, http.StatusConflict)
	harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "ops@zudomart.com", "password": adminPassword}, nil, http.StatusUnauthorized)

	invitationToken := harness.lastLoggedInvitationToken()
	harness.expect("POST", "/api/v1/admin/auth/accept-invitation", map[string]string{"token": invitationToken, "password": "short1"}, nil, http.StatusUnprocessableEntity)
	harness.expect("POST", "/api/v1/admin/auth/accept-invitation", map[string]string{"token": invitationToken, "password": adminPassword}, nil, http.StatusNoContent)
	harness.expect("POST", "/api/v1/admin/auth/accept-invitation", map[string]string{"token": invitationToken, "password": adminPassword}, nil, http.StatusBadRequest)

	adminSession, adminSecret := harness.enrollAndSignIn("ops@zudomart.com", adminPassword)
	adminToken := adminSession["accessToken"].(string)
	adminId := adminSession["staff"].(map[string]any)["id"].(string)
	harness.expect("GET", "/api/v1/admin/admins", nil, bearer(adminToken), http.StatusForbidden)
	adminStepUp := bearerWithStepUp(adminToken, harness.grantStepUp(adminToken, adminSecret, 1))
	notSuperadmin := harness.expect("POST", "/api/v1/admin/admins", map[string]any{"email": "third@zudomart.com", "permissions": []string{}}, adminStepUp, http.StatusForbidden)
	if notSuperadmin["code"] != "SUPERADMIN_REQUIRED" {
		t.Fatalf("unexpected %v", notSuperadmin)
	}

	permissions := map[string]any{"permissions": []string{"admin.audit.read", "admin.staff.read"}}
	harness.expect("PATCH", "/api/v1/admin/admins/"+adminId+"/permissions", permissions, bearer(accessToken), http.StatusForbidden)
	harness.expect("PATCH", "/api/v1/admin/admins/"+adminId+"/permissions", permissions, withStepUp, http.StatusOK)
	harness.expect("PATCH", "/api/v1/admin/admins/"+superadminId+"/permissions", permissions, withStepUp, http.StatusNotFound)
	harness.expect("POST", "/api/v1/admin/admins/"+superadminId+"/disable", nil, withStepUp, http.StatusNotFound)
	harness.expect("GET", "/api/v1/admin/admins", nil, bearer(adminToken), http.StatusForbidden)
	refreshed := harness.expect("POST", "/api/v1/admin/auth/refresh", map[string]string{"refreshToken": adminSession["refreshToken"].(string)}, nil, http.StatusOK)
	listed := harness.expect("GET", "/api/v1/admin/admins", nil, bearer(refreshed["accessToken"].(string)), http.StatusOK)
	if len(listed["data"].([]any)) != 2 || listed["nextCursor"] != nil {
		t.Fatalf("unexpected staff list %v", listed)
	}

	harness.expect("POST", "/api/v1/admin/admins/"+adminId+"/disable", nil, withStepUp, http.StatusNoContent)
	harness.expect("POST", "/api/v1/admin/auth/refresh", map[string]string{"refreshToken": refreshed["refreshToken"].(string)}, nil, http.StatusUnauthorized)
	harness.expect("GET", "/api/v1/admin/auth/me", nil, bearer(refreshed["accessToken"].(string)), http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "ops@zudomart.com", "password": adminPassword}, nil, http.StatusUnauthorized)
	waitForEventTypes(t, harness, "staff.invited")
}

func TestRefreshRotationReuseDetectionAndLogout(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	harness.bootstrapSuperadmin("rotator@zudomart.com")
	session, secret := harness.enrollAndSignIn("rotator@zudomart.com", strongPassword)
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

	fresh := harness.signInWithMfa("rotator@zudomart.com", strongPassword, secret, 0)
	token := fresh["accessToken"].(string)
	harness.expect("POST", "/api/v1/admin/auth/logout", nil, bearer(token), http.StatusNoContent)
	harness.expect("GET", "/api/v1/admin/auth/me", nil, bearer(token), http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/admin/auth/refresh", map[string]string{"refreshToken": fresh["refreshToken"].(string)}, nil, http.StatusUnauthorized)
}

func TestFiveWrongPasswordsLockTheAccountWithoutRevealingIt(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	harness.bootstrapSuperadmin("locked@zudomart.com")
	for attempt := 1; attempt <= 5; attempt++ {
		result := harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "locked@zudomart.com", "password": "definitely-wrong-1"}, nil, http.StatusUnauthorized)
		if result["code"] != "INVALID_CREDENTIALS" {
			t.Fatalf("attempt %d: %v", attempt, result)
		}
	}
	locked := harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "locked@zudomart.com", "password": strongPassword}, nil, http.StatusUnauthorized)
	unknown := harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "ghost@zudomart.com", "password": strongPassword}, nil, http.StatusUnauthorized)
	if locked["code"] != unknown["code"] || locked["message"] != unknown["message"] {
		t.Fatalf("locked and unknown accounts must look the same: %v vs %v", locked, unknown)
	}
}

func TestLoginRateLimitReturns429PerEmail(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	limited := 0
	for attempt := 0; attempt < 14; attempt++ {
		if harness.call("POST", "/api/v1/admin/auth/login", map[string]string{"email": "spray@zudomart.com", "password": "whatever-pass-1"}, nil).status == http.StatusTooManyRequests {
			limited++
		}
	}
	if limited == 0 {
		t.Fatal("expected the limiter to refuse some attempts")
	}
	harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "other@zudomart.com", "password": "whatever-pass-1"}, nil, http.StatusUnauthorized)
}
