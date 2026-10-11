package admin

import (
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func withAddress(headers map[string]string, address string) map[string]string {
	copied := map[string]string{"X-Real-Ip": address}
	for name, value := range headers {
		copied[name] = value
	}
	return copied
}

func auditActions(harness *adminHarness, token, query string) []string {
	entries := harness.expect("GET", "/api/v1/admin/audit?"+query, nil, bearer(token), http.StatusOK)["data"].([]any)
	actions := []string{}
	for _, entry := range entries {
		actions = append(actions, entry.(map[string]any)["action"].(string))
	}
	return actions
}

func TestRecoveryCodesAreIssuedOnEnrollmentSingleUseAndRegeneratedWithStepUp(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	harness.bootstrapSuperadmin("recovery@zudomart.com")
	session, secret := harness.enrollAndSignIn("recovery@zudomart.com", strongPassword)
	codes := session["recoveryCodes"].([]any)
	if len(codes) != 8 {
		t.Fatalf("enrollment returns eight recovery codes, got %v", codes)
	}
	signInWithCode := func(code string, status int) map[string]any {
		challenge := harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "recovery@zudomart.com", "password": strongPassword}, nil, http.StatusOK)
		return harness.expect("POST", "/api/v1/admin/auth/mfa/verify", map[string]string{"challengeToken": challenge["challengeToken"].(string), "code": code}, nil, status)
	}
	signedIn := signInWithCode(codes[0].(string), http.StatusOK)
	signInWithCode(codes[0].(string), http.StatusUnauthorized)
	accessToken := signedIn["accessToken"].(string)
	account := harness.expect("GET", "/api/v1/admin/account", nil, bearer(accessToken), http.StatusOK)
	if account["recoveryCodesRemaining"] != float64(7) || account["account"].(map[string]any)["email"] != "recovery@zudomart.com" {
		t.Fatalf("unexpected account %v", account)
	}
	if denied := harness.expect("POST", "/api/v1/admin/account/recovery-codes/regenerate", nil, bearer(accessToken), http.StatusForbidden); denied["code"] != "STEP_UP_REQUIRED" {
		t.Fatalf("regeneration needs step-up: %v", denied)
	}
	stepUp := harness.grantStepUp(accessToken, secret, 1)
	fresh := harness.expect("POST", "/api/v1/admin/account/recovery-codes/regenerate", nil, bearerWithStepUp(accessToken, stepUp), http.StatusOK)["recoveryCodes"].([]any)
	if len(fresh) != 8 {
		t.Fatalf("expected eight new codes, got %v", fresh)
	}
	signInWithCode(codes[1].(string), http.StatusUnauthorized)
	signInWithCode(fresh[0].(string), http.StatusOK)
	recovery := harness.expect("POST", "/api/v1/admin/auth/step-up", map[string]string{"method": "recovery", "code": fresh[1].(string)}, bearer(accessToken), http.StatusBadRequest)
	if recovery["code"] != "VALIDATION_FAILED" {
		t.Fatalf("recovery codes cannot step up: %v", recovery)
	}
}

func TestOwnSessionsAreListedRevokedAndAudited(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	harness.bootstrapSuperadmin("sessions@zudomart.com")
	first, secret := harness.enrollAndSignIn("sessions@zudomart.com", strongPassword)
	second := harness.signInWithMfa("sessions@zudomart.com", strongPassword, secret, 0)
	token := second["accessToken"].(string)
	sessions := harness.expect("GET", "/api/v1/admin/account/sessions", nil, bearer(token), http.StatusOK)["data"].([]any)
	if len(sessions) != 2 {
		t.Fatalf("expected two sessions, got %v", sessions)
	}
	var other string
	for _, entry := range sessions {
		session := entry.(map[string]any)
		if session["isCurrent"] == false {
			other = session["id"].(string)
		}
	}
	if other == "" {
		t.Fatalf("one session is the current one: %v", sessions)
	}
	harness.expect("POST", "/api/v1/admin/account/sessions/"+other+"/revoke", nil, bearer(token), http.StatusNoContent)
	harness.expect("POST", "/api/v1/admin/account/sessions/"+other+"/revoke", nil, bearer(token), http.StatusNotFound)
	harness.expect("GET", "/api/v1/admin/auth/me", nil, bearer(first["accessToken"].(string)), http.StatusUnauthorized)
	if actions := auditActions(harness, token, "action=admin.session_revoked"); len(actions) != 1 {
		t.Fatalf("revocation is audited: %v", actions)
	}
}

func TestPasskeysRegisterSignInStepUpAndAreRemovedOnMfaReset(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	root := harness.signedInSuperadmin("root.passkeys@zudomart.com")
	member, _ := harness.inviteAndSignIn(root, map[string]any{"email": "keys@zudomart.com", "name": "Keys", "role": "ADMIN", "permissions": []string{"audit:read"}, "reason": "passkey user"})
	passkey := newSoftPasskey(t)
	harness.expect("POST", "/api/v1/admin/account/passkeys/options", nil, bearer(member.token), http.StatusForbidden)
	withStepUp := member.withStepUp(harness)
	options := harness.expect("POST", "/api/v1/admin/account/passkeys/options", nil, withStepUp, http.StatusOK)
	added := harness.expect("POST", "/api/v1/admin/account/passkeys", map[string]any{"label": "Work laptop", "credential": passkey.register(options)}, withStepUp, http.StatusCreated)
	if added["label"] != "Work laptop" || added["lastUsedAt"] != nil {
		t.Fatalf("unexpected passkey %v", added)
	}
	harness.expect("POST", "/api/v1/admin/account/passkeys", map[string]any{"label": "Replay", "credential": passkey.register(options)}, withStepUp, http.StatusConflict)

	challenge := harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "keys@zudomart.com", "password": adminPassword}, nil, http.StatusOK)
	if challenge["passkeyAvailable"] != true {
		t.Fatalf("login advertises the passkey: %v", challenge)
	}
	token := challenge["challengeToken"].(string)
	harness.expect("POST", "/api/v1/admin/auth/mfa/verify", map[string]any{"challengeToken": token, "method": "webauthn", "credential": passkey.assert(map[string]any{"challenge": "c3RhbGU"})}, nil, http.StatusUnauthorized)
	signInOptions := harness.expect("POST", "/api/v1/admin/auth/mfa/webauthn/options", map[string]string{"mfaToken": token}, nil, http.StatusOK)
	signedIn := harness.expect("POST", "/api/v1/admin/auth/mfa/verify", map[string]any{"challengeToken": token, "method": "webauthn", "credential": passkey.assert(signInOptions)}, nil, http.StatusOK)
	accessToken := signedIn["accessToken"].(string)

	stepUpOptions := harness.expect("POST", "/api/v1/admin/auth/step-up/webauthn/options", nil, bearer(accessToken), http.StatusOK)
	stepUp := harness.expect("POST", "/api/v1/admin/auth/step-up", map[string]any{"method": "webauthn", "credential": passkey.assert(stepUpOptions)}, bearer(accessToken), http.StatusOK)
	if stepUp["stepUpToken"] == nil {
		t.Fatalf("passkey step-up issues a token: %v", stepUp)
	}
	account := harness.expect("GET", "/api/v1/admin/account", nil, bearer(accessToken), http.StatusOK)
	passkeys := account["passkeys"].([]any)
	if len(passkeys) != 1 || passkeys[0].(map[string]any)["lastUsedAt"] == nil || account["account"].(map[string]any)["passkeyCount"] != float64(1) {
		t.Fatalf("passkey use is tracked: %v", account)
	}

	harness.expect("POST", "/api/v1/admin/admins/"+member.id+"/reset-mfa", map[string]string{"reason": "lost all devices"}, root.withStepUp(harness), http.StatusOK)
	reset := harness.expect("GET", "/api/v1/admin/admins/"+member.id, nil, bearer(root.token), http.StatusOK)["admin"].(map[string]any)
	if reset["passkeyCount"] != float64(0) || reset["mfaEnrolled"] != false {
		t.Fatalf("reset-mfa removes passkeys and TOTP: %v", reset)
	}
	if actions := auditActions(harness, root.token, "action=admin.passkey_added"); len(actions) != 1 {
		t.Fatalf("passkey registration is audited: %v", actions)
	}
}

func TestIpAllowListIsEnforcedAtLoginAndOnEveryStaffRequest(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	root := harness.signedInSuperadmin("root.network@zudomart.com")
	member, _ := harness.inviteAndSignIn(root, map[string]any{"email": "office@zudomart.com", "name": "Office", "role": "ADMIN", "permissions": []string{"audit:read"}, "reason": "office only"})
	path := "/api/v1/admin/admins/" + member.id
	harness.expect("PATCH", path, map[string]any{"ipAllowList": []string{"300.0.0.1"}, "reason": "office network"}, root.withStepUp(harness), http.StatusBadRequest)
	updated := harness.expect("PATCH", path, map[string]any{"ipAllowList": []string{"203.0.113.0/24"}, "reason": "office network"}, root.withStepUp(harness), http.StatusOK)["admin"].(map[string]any)
	if list := updated["ipAllowList"].([]any); len(list) != 1 || list[0] != "203.0.113.0/24" {
		t.Fatalf("unexpected allow list %v", updated)
	}
	if refused := harness.expect("GET", "/api/v1/admin/auth/me", nil, withAddress(bearer(member.token), "198.51.100.9"), http.StatusForbidden); refused["code"] != "IP_NOT_ALLOWED" {
		t.Fatalf("unexpected refusal %v", refused)
	}
	harness.expect("GET", "/api/v1/admin/auth/me", nil, withAddress(bearer(member.token), "203.0.113.40"), http.StatusOK)
	harness.expect("GET", "/api/v1/admin/auth/me", nil, withAddress(bearer(member.token), "::ffff:203.0.113.41"), http.StatusOK)
	login := map[string]string{"email": "office@zudomart.com", "password": adminPassword}
	harness.expect("POST", "/api/v1/admin/auth/login", login, map[string]string{"X-Real-Ip": "198.51.100.9"}, http.StatusForbidden)
	harness.expect("POST", "/api/v1/admin/auth/login", login, map[string]string{"X-Real-Ip": "203.0.113.40"}, http.StatusOK)
	harness.expect("GET", "/api/v1/admin/auth/me", nil, withAddress(bearer(root.token), "198.51.100.9"), http.StatusOK)
	internal := map[string]string{"X-Internal-Token": harness.settings.InternalApiToken}
	policy := "/api/v1/internal/admins/" + member.id + "/network-policy?address="
	if decision := harness.expect("GET", policy+"198.51.100.9", nil, internal, http.StatusOK); decision["allowed"] != false {
		t.Fatalf("other services must be told the office-only admin is refused elsewhere: %v", decision)
	}
	if decision := harness.expect("GET", policy+"203.0.113.40", nil, internal, http.StatusOK); decision["allowed"] != true {
		t.Fatalf("the office network is allowed: %v", decision)
	}
	harness.expect("GET", policy+"not-an-ip", nil, internal, http.StatusBadRequest)
	harness.expect("GET", policy+"203.0.113.40", nil, map[string]string{"X-Internal-Token": strings.Repeat("x", 32)}, http.StatusUnauthorized)
	if decision := harness.expect("GET", "/api/v1/internal/admins/"+uuid.NewString()+"/network-policy?address=203.0.113.40", nil, internal, http.StatusOK); decision["allowed"] != false {
		t.Fatalf("an unknown staff id is never allowed: %v", decision)
	}
	harness.expect("PATCH", "/api/v1/admin/admins/"+root.id, map[string]any{"ipAllowList": []string{}, "reason": "edit myself"}, root.withStepUp(harness), http.StatusConflict)
}

func TestMutationsWithoutTheirOwnAuditAreRecordedByTheCatchAll(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	root := harness.signedInSuperadmin("root.catchall@zudomart.com")
	harness.expect("PATCH", "/api/v1/admin/users/me/preferences", map[string]string{"theme": "purple"}, bearer(root.token), http.StatusBadRequest)
	harness.expect("PATCH", "/api/v1/admin/users/me/preferences", map[string]string{"theme": "dark"}, bearer(root.token), http.StatusNoContent)
	consent := map[string]any{"policyVersion": "0.1-draft", "decidedAt": "2026-10-05T10:00:00Z", "categories": map[string]bool{"analytics": true, "personalization": false, "advertising": false}, "source": "web_banner"}
	harness.expect("POST", "/api/v1/admin/consents", consent, bearer(root.token), http.StatusNoContent)
	harness.expect("POST", "/api/v1/admin/consents", map[string]any{"policyVersion": "1", "decidedAt": "2026-10-05T10:00:00Z", "categories": map[string]bool{"tracking": true}, "source": "web_banner"}, bearer(root.token), http.StatusBadRequest)
	if theme := harness.expect("GET", "/api/v1/admin/account", nil, bearer(root.token), http.StatusOK)["preferences"].(map[string]any)["theme"]; theme != "dark" {
		t.Fatalf("theme is stored, got %v", theme)
	}
	entries := harness.expect("GET", "/api/v1/admin/audit?action=admin.request", nil, bearer(root.token), http.StatusOK)["data"].([]any)
	if len(entries) != 2 {
		t.Fatalf("each successful unaudited mutation is recorded once: %v", entries)
	}
	harness.grantStepUp(root.token, root.secret, 1)
	if again := harness.expect("GET", "/api/v1/admin/audit?action=admin.request", nil, bearer(root.token), http.StatusOK)["data"].([]any); len(again) != 2 {
		t.Fatalf("audited mutations are not recorded twice: %v", again)
	}
}

func TestConfigurationVersionsAreListedAndRestoredWithStepUp(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	accessToken, withStepUp := harness.signedInSuperadminWithStepUp("versions@zudomart.com")
	path := "/api/v1/admin/config/username-rules"
	original := harness.expect("GET", path, nil, bearer(accessToken), http.StatusOK)
	if original["updatedBy"].(map[string]any)["name"] != "System" || original["isArchived"] != false || original["changeReason"] != "initial defaults" {
		t.Fatalf("unexpected seeded document %v", original)
	}
	changed := map[string]any{"changesAllowedPerWindow": 2, "changeWindowDays": 30, "minimumLength": 4, "maximumLength": 24, "allowedCharacterClasses": []string{"LOWERCASE_LETTERS", "DIGITS"}, "mustStartWithLetter": true, "releasedUsernameCooldownDays": 120}
	harness.expect("PUT", path, map[string]any{"content": changed, "expectedVersion": 1, "reason": "shorter handles"}, withStepUp, http.StatusOK)
	versions := harness.expect("GET", path+"/versions", nil, bearer(accessToken), http.StatusOK)["data"].([]any)
	if len(versions) != 2 || versions[0].(map[string]any)["version"] != float64(2) || versions[0].(map[string]any)["changeReason"] != "shorter handles" {
		t.Fatalf("unexpected history %v", versions)
	}
	restore := path + "/versions/1/restore"
	harness.expect("POST", restore, map[string]any{"expectedVersion": 2, "reason": "back to defaults"}, bearer(accessToken), http.StatusForbidden)
	harness.expect("POST", restore, map[string]any{"expectedVersion": 1, "reason": "back to defaults"}, withStepUp, http.StatusConflict)
	harness.expect("POST", path+"/versions/9/restore", map[string]any{"expectedVersion": 2, "reason": "no such version"}, withStepUp, http.StatusNotFound)
	restored := harness.expect("POST", restore, map[string]any{"expectedVersion": 2, "reason": "back to defaults"}, withStepUp, http.StatusOK)
	if restored["version"] != float64(3) || restored["content"].(map[string]any)["minimumLength"] != float64(3) || restored["updatedBy"].(map[string]any)["name"] != "Root" {
		t.Fatalf("unexpected restore %v", restored)
	}
	for _, key := range []string{"plans", "revenue", "creator-eligibility"} {
		harness.expect("GET", "/api/v1/admin/config/"+key, nil, bearer(accessToken), http.StatusOK)
	}
	if actions := auditActions(harness, accessToken, "action=platform_setting.restored"); len(actions) != 1 {
		t.Fatalf("restores are audited: %v", actions)
	}
}

func TestOverviewMetricsNeedMetricsReadAndDegradeWithoutSources(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	root := harness.signedInSuperadmin("root.metrics@zudomart.com")
	member, _ := harness.inviteAndSignIn(root, map[string]any{"email": "auditor.metrics@zudomart.com", "name": "Auditor", "role": "ADMIN", "permissions": []string{"audit:read"}, "reason": "no metrics"})
	harness.expect("GET", "/api/v1/admin/metrics/overview?range=7d", nil, bearer(member.token), http.StatusForbidden)
	harness.expect("GET", "/api/v1/admin/metrics/overview?range=90d", nil, bearer(root.token), http.StatusBadRequest)
	metrics := harness.expect("GET", "/api/v1/admin/metrics/overview?range=24h", nil, bearer(root.token), http.StatusOK)
	if metrics["range"] != "24h" || len(metrics["commerce"].(map[string]any)["ordersSeries"].([]any)) != 24 || len(metrics["health"].([]any)) != 5 || len(metrics["queues"].([]any)) != 3 {
		t.Fatalf("unexpected metrics %v", metrics)
	}
}

func TestStaffPasswordsFollowTheFullPolicyWhenAcceptingInvitations(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	root := harness.signedInSuperadmin("root.passwords@zudomart.com")
	harness.expect("POST", "/api/v1/admin/admins", map[string]any{"email": "adaeze@zudomart.com", "name": "Adaeze Obi", "role": "ADMIN", "permissions": []string{"audit:read"}, "reason": "new hire"}, root.withStepUp(harness), http.StatusCreated)
	token := harness.lastLoggedInvitationToken()
	weak := harness.expect("POST", "/api/v1/admin/auth/accept-invitation", map[string]string{"token": token, "password": "adaeze-lantern-81"}, nil, http.StatusBadRequest)
	if issues := weak["issues"].([]any); len(issues) != 2 {
		t.Fatalf("expected the case and name problems, got %v", weak)
	}
	harness.expect("POST", "/api/v1/admin/auth/accept-invitation", map[string]string{"token": token, "password": adminPassword}, nil, http.StatusNoContent)
}
