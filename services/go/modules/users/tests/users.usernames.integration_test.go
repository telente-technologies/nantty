package users_test

import (
	"net/http"
	"testing"
)

func TestChangeUsernameEnforcesRulesCooldownAndQuarantine(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, adaToken := harness.newAccount("ada.lovelace", "Ada")
	_, graceToken := harness.newAccount("grace.hopper", "Grace")

	policy := harness.expect("GET", "/api/v1/users/me/username-policy", adaToken, nil, http.StatusOK)
	if policy["canChangeNow"] != true || policy["changesRemainingThisYear"] != float64(3) || len(policy["rules"].([]any)) == 0 {
		t.Fatalf("unexpected policy %v", policy)
	}
	for username, wantStatus := range map[string]int{"g00gle": 422, "official.admin": 422, "ab": 422, "grace.hopper": 409, "ada.lovelace": 422, "Zud0mart": 422} {
		harness.expect("PATCH", "/api/v1/users/me/username", adaToken, map[string]string{"username": username}, wantStatus)
	}
	changed := harness.expect("PATCH", "/api/v1/users/me/username", adaToken, map[string]string{"username": "@Ada_Byron"}, http.StatusOK)
	if changed["username"] != "ada_byron" {
		t.Fatalf("unexpected change %v", changed)
	}
	if !harness.audit.has("user.username_changed") {
		t.Fatalf("a username change is audited: %v", harness.audit.actions)
	}
	if account, _, _ := harness.accounts.FindAccountSummary(nil, mustParseUuid(changed["id"].(string))); account.Username != "ada_byron" {
		t.Fatalf("account directory was not renamed: %v", account.Username)
	}
	tooSoon := harness.expect("PATCH", "/api/v1/users/me/username", adaToken, map[string]string{"username": "ada.again"}, http.StatusTooManyRequests)
	if tooSoon["code"] != "USERNAME_CHANGE_TOO_SOON" {
		t.Fatalf("unexpected %v", tooSoon)
	}
	after := harness.expect("GET", "/api/v1/users/me/username-policy", adaToken, nil, http.StatusOK)
	if after["canChangeNow"] != false || after["changesRemainingThisYear"] != float64(2) || after["nextChangeAvailableAt"] == nil {
		t.Fatalf("unexpected policy after change %v", after)
	}
	harness.expect("PATCH", "/api/v1/users/me/username", graceToken, map[string]string{"username": "ada.lovelace"}, http.StatusUnprocessableEntity)
	harness.expect("GET", "/api/v1/users/username/ada.lovelace", graceToken, nil, http.StatusNotFound)
	harness.expect("GET", "/api/v1/users/username/ada_byron", graceToken, nil, http.StatusOK)
	harness.waitForPublishedEvents("username.changed")
}

func TestChangedUsernameRulesSettingTakesEffect(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, adaToken := harness.newAccount("ada.lovelace", "Ada")
	harness.settings.usernameRules = `{"changesAllowedPerWindow":2,"changeWindowDays":10,"minimumLength":3,"maximumLength":30,"allowedCharacterClasses":["LOWERCASE_LETTERS"],"mustStartWithLetter":false,"releasedUsernameCooldownDays":5}`
	policy := harness.expect("GET", "/api/v1/users/me/username-policy", adaToken, nil, http.StatusOK)
	if policy["cooldownDays"] != float64(10) || policy["quarantineDays"] != float64(5) {
		t.Fatalf("policy must follow the admin setting, got %v", policy)
	}
	harness.expect("PATCH", "/api/v1/users/me/username", adaToken, map[string]string{"username": "ada.first"}, http.StatusOK)
	harness.expect("PATCH", "/api/v1/users/me/username", adaToken, map[string]string{"username": "ada.second"}, http.StatusOK)
	harness.expect("PATCH", "/api/v1/users/me/username", adaToken, map[string]string{"username": "ada.third"}, http.StatusTooManyRequests)
	harness.settings.usernameRules = `{"changesAllowedPerWindow":3,"changeWindowDays":10,"releasedUsernameCooldownDays":5}`
	harness.expect("PATCH", "/api/v1/users/me/username", adaToken, map[string]string{"username": "ada.third"}, http.StatusOK)
	harness.settings.usernameRules = `not json`
	fallback := harness.expect("GET", "/api/v1/users/me/username-policy", adaToken, nil, http.StatusOK)
	if fallback["cooldownDays"] != float64(30) || fallback["quarantineDays"] != float64(120) || fallback["canChangeNow"] != false {
		t.Fatalf("an unreadable setting must fall back to the environment, got %v", fallback)
	}
}

func TestStaffCanReserveAndWithholdUsernamesWithAudit(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, adaToken := harness.newAccount("ada.lovelace", "Ada")
	staffToken, stepUp := harness.staffHeaders("users.usernames.reserve", "users.usernames.withhold", "users.usernames.read")
	readOnlyToken, _ := harness.staffHeaders("users.usernames.read")

	harness.expect("POST", "/api/v1/admin/usernames/reserved", "", map[string]string{"term": "lagosstate", "matchKind": "prefix"}, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/admin/usernames/reserved", adaToken, map[string]string{"term": "lagosstate", "matchKind": "prefix"}, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/admin/usernames/reserved", readOnlyToken, map[string]string{"term": "lagosstate", "matchKind": "prefix"}, http.StatusForbidden)
	harness.expect("POST", "/api/v1/admin/usernames/reserved", staffToken, map[string]string{"term": "lagosstate", "matchKind": "prefix"}, http.StatusForbidden)
	rule := harness.expect("POST", "/api/v1/admin/usernames/reserved", staffToken, map[string]string{"term": "lagosstate", "matchKind": "prefix"}, http.StatusCreated, stepUp...)
	harness.expect("POST", "/api/v1/admin/usernames/reserved", staffToken, map[string]string{"term": "lagosstate", "matchKind": "prefix"}, http.StatusUnprocessableEntity, stepUp...)
	harness.expect("POST", "/api/v1/admin/usernames/reserved", staffToken, map[string]string{"term": "x", "matchKind": "prefix"}, http.StatusBadRequest, stepUp...)
	listed := harness.expect("GET", "/api/v1/admin/usernames/reserved", staffToken, nil, http.StatusOK)
	if len(listed["data"].([]any)) != 1 || listed["nextCursor"] != nil {
		t.Fatalf("unexpected list %v", listed)
	}

	harness.expect("PATCH", "/api/v1/users/me/username", adaToken, map[string]string{"username": "lagosstate.gov"}, http.StatusUnprocessableEntity)
	harness.expect("POST", "/api/v1/admin/usernames/withheld", staffToken, map[string]string{"username": "cbn.official", "reason": "central bank"}, http.StatusNoContent, stepUp...)
	blocked := harness.expect("PATCH", "/api/v1/users/me/username", adaToken, map[string]string{"username": "cbn.official"}, http.StatusUnprocessableEntity)
	if blocked["code"] != "USERNAME_UNAVAILABLE" {
		t.Fatalf("withheld names must be unavailable: %v", blocked)
	}
	harness.expect("POST", "/api/v1/admin/usernames/withheld", staffToken, map[string]string{"username": "ada.lovelace", "reason": "in use right now"}, http.StatusConflict, stepUp...)
	harness.expect("DELETE", "/api/v1/admin/usernames/withheld/cbn.official?reason=cleared+by+legal", staffToken, nil, http.StatusNoContent, stepUp...)
	harness.expect("DELETE", "/api/v1/admin/usernames/withheld/cbn.official?reason=cleared+by+legal", staffToken, nil, http.StatusNotFound, stepUp...)
	harness.expect("DELETE", "/api/v1/admin/usernames/reserved/"+rule["id"].(string), staffToken, nil, http.StatusNoContent, stepUp...)
	harness.expect("PATCH", "/api/v1/users/me/username", adaToken, map[string]string{"username": "lagosstate.gov"}, http.StatusOK)
	domainActions := []string{}
	for _, action := range harness.audit.actions {
		if action != "admin.request" {
			domainActions = append(domainActions, action)
		}
	}
	if len(domainActions) != 5 {
		t.Fatalf("expected 5 audit events, got %v", harness.audit.actions)
	}
	if !harness.audit.has("user.username_changed") {
		t.Fatalf("the user's own rename is audited: %v", harness.audit.actions)
	}
}

func TestUsernameSuggestionIsValidAndAvailable(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	harness.newAccount("chidi", "Chidi")
	suggestion := harness.expect("GET", "/api/v1/auth/username-suggestion?seed=chidi@example.com", "", nil, http.StatusOK)["username"].(string)
	if len(suggestion) < 5 || suggestion == "chidi" {
		t.Fatalf("unexpected suggestion %q", suggestion)
	}
	fallback := harness.expect("GET", "/api/v1/auth/username-suggestion?seed=admin@example.com", "", nil, http.StatusOK)["username"].(string)
	if len(fallback) < 5 || fallback[:5] == "admin" {
		t.Fatalf("reserved seed must not be used: %q", fallback)
	}
}
