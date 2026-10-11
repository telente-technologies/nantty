package users

import (
	"net/http"
	"strings"
	"testing"
)

func TestAdminCatalogTopicsAreManagedAndAudited(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, fanToken := harness.newAccount("topic.follower", "Follower")
	harness.expectList("PUT", "/api/v1/users/me/topics", fanToken, map[string]any{"topicIds": []string{"fashion", "music", "food"}}, http.StatusOK)
	reader, _ := harness.staffHeaders("users:read")
	manager, _ := harness.staffHeaders("catalog:manage")
	harness.expect("GET", "/api/v1/admin/catalog/topics", reader, nil, http.StatusForbidden)
	listed := harness.expect("GET", "/api/v1/admin/catalog/topics?search=fash", manager, nil, http.StatusOK)["items"].([]any)
	if len(listed) != 1 || listed[0].(map[string]any)["followerCount"] != float64(1) || listed[0].(map[string]any)["status"] != "ACTIVE" {
		t.Fatalf("unexpected topic list %v", listed)
	}
	harness.expect("POST", "/api/v1/admin/catalog/topics", manager, map[string]any{"name": "Street Food", "reason": "x"}, http.StatusBadRequest)
	created := harness.expect("POST", "/api/v1/admin/catalog/topics", manager, map[string]any{"name": "Street Food", "reason": "requested by creators"}, http.StatusCreated)["item"].(map[string]any)
	if created["id"] != "street-food" || created["slug"] != "street-food" {
		t.Fatalf("unexpected created topic %v", created)
	}
	harness.expect("POST", "/api/v1/admin/catalog/topics", manager, map[string]any{"name": "street food", "reason": "requested by creators"}, http.StatusConflict)
	trending := harness.expect("PATCH", "/api/v1/admin/catalog/topics/street-food", manager, map[string]any{"isTrending": true, "reason": "festival week"}, http.StatusOK)["item"].(map[string]any)
	if trending["isTrending"] != true {
		t.Fatalf("the topic is trending: %v", trending)
	}
	hidden := harness.expect("PATCH", "/api/v1/admin/catalog/topics/street-food", manager, map[string]any{"status": "HIDDEN", "reason": "off season now"}, http.StatusOK)["item"].(map[string]any)
	if hidden["status"] != "HIDDEN" || hidden["isTrending"] != false {
		t.Fatalf("hiding clears trending: %v", hidden)
	}
	harness.expect("PATCH", "/api/v1/admin/catalog/topics/street-food", manager, map[string]any{"isTrending": true, "reason": "festival week"}, http.StatusConflict)
	for _, item := range harness.expectList("GET", "/api/v1/topics", "", nil, http.StatusOK) {
		if item["id"] == "street-food" {
			t.Fatal("hidden topics leave the public catalogue")
		}
	}
	detail := harness.expect("GET", "/api/v1/admin/catalog/topics/street-food", manager, nil, http.StatusOK)
	if detail["item"].(map[string]any)["name"] != "Street Food" || detail["history"] == nil {
		t.Fatalf("unexpected detail %v", detail)
	}
	harness.expect("GET", "/api/v1/admin/catalog/topics/nope", manager, nil, http.StatusNotFound)
	if !harness.audit.has("catalog.topic_created") || !harness.audit.has("catalog.topic_updated") {
		t.Fatalf("topic changes are audited: %v", harness.audit.actions)
	}
}

func TestTrustEnforcementActionsAndAppealDecisions(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	authorId, authorToken := harness.newAccount("noisy.author", "Noisy Author")
	staffToken, stepUp := harness.staffHeaders("verification:grant", "users:suspend")
	harness.expect("GET", "/api/v1/users/me", authorToken, nil, http.StatusOK)
	harness.expect("POST", "/api/v1/admin/checkmark-grants", staffToken, map[string]any{"username": "noisy.author", "color": "blue", "reason": "partner programme"}, http.StatusCreated, stepUp...)
	action := func(name, source string) map[string]any {
		return map[string]any{"action": name, "userId": authorId, "actor": map[string]any{"id": "trust-1", "name": "Trust Bot", "role": "system"}, "reason": "confirmed impersonation report", "source": source, "caseId": "0192f1a0-0000-7000-8000-0000000000bb"}
	}
	harness.expect("POST", "/api/v1/internal/enforcement/actions", "", action("revoke_verification", "content_report"), http.StatusUnauthorized)
	first := harness.expect("POST", "/api/v1/internal/enforcement/actions", "", action("revoke_verification", "content_report"), http.StatusOK, internalToken...)
	again := harness.expect("POST", "/api/v1/internal/enforcement/actions", "", action("revoke_verification", "content_report"), http.StatusOK, internalToken...)
	if first["revoked"] != float64(1) || again["revoked"] != float64(0) || again["alreadyApplied"] != true {
		t.Fatalf("revoking is idempotent: %v %v", first, again)
	}
	if me := harness.expect("GET", "/api/v1/users/me", authorToken, nil, http.StatusOK); me["verified"] == true {
		t.Fatalf("the badge is gone: %v", me)
	}
	summaries := harness.expect("POST", "/api/v1/internal/users/summaries", "", map[string]any{"ids": []string{authorId}}, http.StatusOK, internalToken...)["data"].([]any)
	if summaries[0].(map[string]any)["emailVerified"] != true || summaries[0].(map[string]any)["verification"].(map[string]any)["status"] != "REVOKED" {
		t.Fatalf("the summary carries emailVerified and the revoked checkmark: %v", summaries)
	}

	harness.expect("POST", "/api/v1/admin/users/"+authorId+"/suspend", staffToken, map[string]any{"durationDays": 30, "reasonCode": "SCAM", "reason": "scam listings"}, http.StatusOK, stepUp...)
	harness.expect("POST", "/api/v1/users/me/suspension/appeal", authorToken, map[string]string{"message": "These were my own products, please look again."}, http.StatusNoContent)
	harness.waitForPublishedEvents("suspensionAppeal.submitted")
	caseId := harness.expect("GET", "/api/v1/admin/suspensions/accounts?appeal=PENDING", staffToken, nil, http.StatusOK)["data"].([]any)[0].(map[string]any)["caseId"].(string)
	decide := map[string]any{"outcome": "OVERTURNED", "reason": "receipts confirm ownership", "actor": map[string]any{"id": "staff-9", "name": "Appeals Lead"}}
	path := "/api/v1/internal/suspensions/" + caseId + "/appeal/decide"
	harness.expect("POST", path, "", decide, http.StatusUnauthorized)
	decided := harness.expect("POST", path, "", decide, http.StatusOK, internalToken...)
	repeated := harness.expect("POST", path, "", decide, http.StatusOK, internalToken...)
	if decided["alreadyDecided"] != false || repeated["alreadyDecided"] != true {
		t.Fatalf("deciding is idempotent: %v %v", decided, repeated)
	}
	harness.expect("POST", path, "", map[string]any{"outcome": "UPHELD", "reason": "changed my mind", "actor": map[string]any{"id": "staff-9"}}, http.StatusConflict, internalToken...)
	if strings.Contains(strings.Join(harness.publisher.PublishedEventTypes(), ","), "appeal.decided") {
		t.Fatal("trust publishes appeal.decided for decisions it makes")
	}
	reinstated := harness.expect("POST", "/api/v1/internal/enforcement/actions", "", action("reinstate", "appeal"), http.StatusOK, internalToken...)
	if reinstated["alreadyApplied"] != true {
		t.Fatalf("the overturned suspension is already lifted: %v", reinstated)
	}
	harness.expect("POST", "/api/v1/admin/users/"+authorId+"/suspend", staffToken, map[string]any{"durationDays": 30, "reasonCode": "SCAM", "reason": "scam listings again"}, http.StatusOK, stepUp...)
	lifted := harness.expect("POST", "/api/v1/internal/enforcement/actions", "", action("reinstate", "appeal"), http.StatusOK, internalToken...)
	if lifted["user"].(map[string]any)["status"] != "ACTIVE" || !harness.audit.has("user.reinstated.appeal") {
		t.Fatalf("reinstate lifts the suspension with an audit entry: %v %v", lifted, harness.audit.actions)
	}
}
