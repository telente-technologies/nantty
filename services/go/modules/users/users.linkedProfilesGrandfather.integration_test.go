package users

import (
	"context"
	"net/http"
	"testing"

	"github.com/jackc/pgx/v5"

	linkedprofiles "zudomart/modules/users/src/modules/linkedProfiles"
)

func TestRuleBreakingAccountsAreGrandfatheredUntilTheOwnerChooses(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	accountId, _ := harness.newAccount("legacy.owner", "Legacy")
	accessToken, stepUpToken := harness.tokens.SignAccountTokensWithStepUpForTest(t, accountId)
	first := harness.expect("POST", "/api/v1/users/me/business-profiles", accessToken, businessBody("legacy.first", ""), http.StatusCreated)
	harness.execSql(`DELETE FROM linked_profiles`)
	second := harness.expect("POST", "/api/v1/users/me/business-profiles", accessToken, businessBody("legacy.second", ""), http.StatusCreated)
	harness.execSql(`DELETE FROM linked_profiles`)

	report, err := linkedprofiles.BackfillRegistry(context.Background(), harness.module.Container())
	if err != nil || report.Registered != 2 || report.Held != 1 || report.HeldAccounts != 1 {
		t.Fatalf("the backfill registers both pages and holds the extra: %+v %v", report, err)
	}
	if again, _ := linkedprofiles.BackfillRegistry(context.Background(), harness.module.Container()); again.Registered != 0 {
		t.Fatalf("the backfill is idempotent: %+v", again)
	}
	summary := harness.linked(accessToken)
	if summary["choiceRequired"] != true {
		t.Fatalf("the owner gets a choose-which-to-keep task: %v", summary)
	}
	statuses := map[string]string{}
	for _, raw := range summary["items"].([]any) {
		item := raw.(map[string]any)
		statuses[item["profileId"].(string)] = item["status"].(string)
	}
	if statuses[first["id"].(string)] != "active" || statuses[second["id"].(string)] != "held" {
		t.Fatalf("the oldest page stays active and the extra is held: %v", statuses)
	}
	if held := readPublishingHeld(harness, second["id"].(string)); !held {
		t.Fatal("a held page must stop accepting posts")
	}

	staffToken, _ := harness.staff("admin", "users:read")
	conflictPage := harness.expect("GET", "/api/v1/admin/linked-profiles/conflicts", staffToken, nil, http.StatusOK)
	conflicts := conflictPage["data"].([]any)
	if len(conflicts) != 1 || conflicts[0].(map[string]any)["accountId"] != accountId || conflictPage["nextCursor"] != nil {
		t.Fatalf("the admin report lists the rule-breaking account: %v", conflictPage)
	}
	harness.expect("GET", "/api/v1/admin/linked-profiles/conflicts?cursor=nope", staffToken, nil, http.StatusBadRequest)
	if after := harness.expect("GET", "/api/v1/admin/linked-profiles/conflicts?cursor="+accountId, staffToken, nil, http.StatusOK)["data"].([]any); len(after) != 0 {
		t.Fatalf("the next page starts after the cursor: %v", after)
	}

	choose := map[string]any{"keep": []string{second["id"].(string)}}
	harness.expect("POST", "/api/v1/users/me/linked-profiles/choose", accessToken, choose, http.StatusForbidden)
	status, body := harness.call("POST", "/api/v1/users/me/linked-profiles/choose", accessToken, map[string]any{"keep": []string{first["id"].(string), second["id"].(string)}}, "X-Step-Up-Token", stepUpToken)
	expectCode(t, status, body, http.StatusConflict, "PROFILE_LIMIT_STORE_OR_BUSINESS")
	chosen := harness.expect("POST", "/api/v1/users/me/linked-profiles/choose", accessToken, choose, http.StatusOK, "X-Step-Up-Token", stepUpToken)
	if chosen["choiceRequired"] != false {
		t.Fatalf("choosing clears the task: %v", chosen)
	}
	if readPublishingHeld(harness, second["id"].(string)) || !readPublishingHeld(harness, first["id"].(string)) {
		t.Fatal("the kept page can post again and the other one cannot")
	}
	harness.expect("PUT", "/api/v1/users/me/acting-profile", accessToken, map[string]string{"profileId": first["id"].(string)}, http.StatusNotFound)
	harness.expect("PUT", "/api/v1/users/me/acting-profile", accessToken, map[string]string{"profileId": second["id"].(string)}, http.StatusOK)
	status, body = harness.call("POST", "/api/v1/users/me/linked-profiles/choose", accessToken, choose, "X-Step-Up-Token", stepUpToken)
	expectCode(t, status, body, http.StatusConflict, "NO_CHOICE_REQUIRED")

	resolve := map[string]any{"keep": []string{first["id"].(string)}, "reason": "Owner asked support to keep the original page"}
	harness.expect("POST", "/api/v1/admin/users/"+accountId+"/linked-profiles/resolve", staffToken, resolve, http.StatusForbidden)
	moderator, moderatorStepUp := harness.staff("admin", "users:moderate")
	harness.expect("POST", "/api/v1/admin/users/"+accountId+"/linked-profiles/resolve", moderator, map[string]any{"keep": resolve["keep"]}, http.StatusBadRequest, moderatorStepUp...)
	harness.expect("POST", "/api/v1/admin/users/"+accountId+"/linked-profiles/resolve", moderator, resolve, http.StatusOK, moderatorStepUp...)
	if !harness.audit.has("linked_profiles.resolved") {
		t.Fatal("an admin resolution is audited")
	}
}

func TestAdminConvertsBetweenStoreAndBusinessWithAReasonAndAudit(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	accountId, token := harness.newAccount("convert.owner", "Convert")
	page := harness.expect("POST", "/api/v1/users/me/business-profiles", token, businessBody("convert.page", ""), http.StatusCreated)
	moderator, stepUp := harness.staff("admin", "users:moderate")
	path := "/api/v1/admin/users/" + accountId + "/linked-profiles/convert"
	body := map[string]any{"profileId": page["id"], "toKind": "store", "reason": "Owner wants to sell instead"}
	harness.expect("POST", path, moderator, body, http.StatusForbidden)
	harness.expect("POST", path, moderator, map[string]any{"profileId": page["id"], "toKind": "store", "reason": "no"}, http.StatusBadRequest, stepUp...)
	converted := harness.expect("POST", path, moderator, body, http.StatusOK, stepUp...)
	if converted["items"].([]any)[0].(map[string]any)["kind"] != "store" || !harness.audit.has("linked_profiles.converted") {
		t.Fatalf("business converts to store with an audit entry: %v", converted)
	}

	catalog := pgx.Identifier{harness.schema + "_catalog"}.Sanitize()
	stores := pgx.Identifier{harness.schema + "_catalog", "stores"}.Sanitize()
	harness.execSql(`CREATE SCHEMA ` + catalog)
	t.Cleanup(func() { harness.execSql(`DROP SCHEMA ` + catalog + ` CASCADE`) })
	harness.execSql(`CREATE TABLE ` + stores + ` (id uuid PRIMARY KEY, owner_account_id uuid NOT NULL, business_profile_id uuid NOT NULL, status text NOT NULL, channel text NOT NULL DEFAULT 'store', created_at timestamptz NOT NULL DEFAULT now())`)
	storeId := "5f0c7a52-8f4d-4e57-9a3e-2f1d0b6c1e11"
	harness.execSql(`INSERT INTO `+stores+` (id, owner_account_id, business_profile_id, status) VALUES ($1, $2, $3, 'active')`, storeId, accountId, page["id"])
	harness.expect("POST", "/api/v1/internal/accounts/"+accountId+"/linked-profiles/claim", "", map[string]any{"kind": "store", "profileId": page["id"], "storeId": storeId}, http.StatusOK, internalHeaders...)
	back := map[string]any{"profileId": page["id"], "toKind": "business", "reason": "Owner closed the shop"}
	status, failed := harness.call("POST", path, moderator, back, stepUp...)
	expectCode(t, status, failed, http.StatusConflict, "STORE_STILL_OPEN")
	harness.execSql(`UPDATE `+stores+` SET status = 'closed' WHERE id = $1`, storeId)
	reverted := harness.expect("POST", path, moderator, back, http.StatusOK, stepUp...)
	item := reverted["items"].([]any)[0].(map[string]any)
	if item["kind"] != "business" || item["storeId"] != nil || item["showsMart"] != false {
		t.Fatalf("a closed store converts back to a business page without the Mart icon: %v", item)
	}
}

func readPublishingHeld(harness *usersTestHarness, profileId string) bool {
	harness.t.Helper()
	return harness.module.Container().Client.Profile.GetX(context.Background(), mustParseUuid(profileId)).PublishingHeld
}
