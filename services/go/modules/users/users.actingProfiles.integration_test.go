package users

import (
	"net/http"
	"strings"
	"testing"
)

func TestBusinessProfileCreatorApplicationAndActingProfileSwitching(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, token := harness.newAccount("ada.lovelace", "Ada Lovelace")
	_, otherToken := harness.newAccount("grace.hopper", "Grace")

	categories := harness.expect("GET", "/api/v1/business-categories", "", nil, http.StatusOK)
	if categories["nextCursor"] != nil {
		t.Fatalf("categories unexpectedly paged: %v", categories)
	}
	harness.expect("GET", "/api/v1/users/me/profiles", "", nil, http.StatusUnauthorized)
	profiles := harness.expect("GET", "/api/v1/users/me/profiles", token, nil, http.StatusOK)["data"].([]any)
	if len(profiles) != 1 || profiles[0].(map[string]any)["kind"] != "person" || profiles[0].(map[string]any)["active"] != true {
		t.Fatalf("every account starts with one personal profile: %v", profiles)
	}
	personalId := profiles[0].(map[string]any)["id"].(string)

	business := map[string]any{"displayName": "Lagos Bakery", "handle": "lagos.bakery", "description": "Fresh bread", "categories": []map[string]any{{"customName": "Artisan baking"}}}
	harness.expect("POST", "/api/v1/users/me/business-profiles", token, map[string]any{"displayName": "X", "handle": "lagos.bakery", "categories": []any{}}, http.StatusBadRequest)
	harness.expect("POST", "/api/v1/users/me/business-profiles", token, map[string]any{"displayName": "Lagos Bakery", "handle": "g00gle", "description": "", "categories": []map[string]any{{"customName": "Bakery"}}}, http.StatusConflict)
	created := harness.expect("POST", "/api/v1/users/me/business-profiles", token, business, http.StatusCreated)
	if created["kind"] != "business" || created["handle"] != "lagos.bakery" || created["name"] != "Lagos Bakery" {
		t.Fatalf("unexpected business profile %v", created)
	}
	harness.expect("POST", "/api/v1/users/me/business-profiles", otherToken, business, http.StatusConflict)

	updated := harness.expect("PATCH", "/api/v1/users/me/business-profiles/"+created["id"].(string), token, map[string]any{"description": "Fresh bread daily", "isPrivate": true}, http.StatusOK)
	if updated["description"] != "Fresh bread daily" || updated["isPrivate"] != true {
		t.Fatalf("unexpected update %v", updated)
	}
	harness.expect("PATCH", "/api/v1/users/me/business-profiles/"+created["id"].(string), otherToken, map[string]any{"description": "hijack"}, http.StatusNotFound)

	switched := harness.expect("PUT", "/api/v1/users/me/acting-profile", token, map[string]string{"profileId": created["id"].(string)}, http.StatusOK)
	if switched["id"] != created["id"] {
		t.Fatalf("unexpected switch %v", switched)
	}
	if current := harness.expect("GET", "/api/v1/users/me/acting-profile", token, nil, http.StatusOK); current["id"] != created["id"] {
		t.Fatalf("acting profile not persisted: %v", current)
	}
	harness.expect("PUT", "/api/v1/users/me/acting-profile", otherToken, map[string]string{"profileId": created["id"].(string)}, http.StatusNotFound)
	harness.expect("PUT", "/api/v1/users/me/acting-profile", token, map[string]string{"profileId": personalId}, http.StatusOK)
	if listed := harness.expect("GET", "/api/v1/users/me/profiles", token, nil, http.StatusOK)["data"].([]any); len(listed) != 2 {
		t.Fatalf("want personal + business, got %v", listed)
	}

	harness.expect("PUT", "/api/v1/internal/profiles/"+personalId+"/signals", "", map[string]any{"realFollowers": 600, "riskScore": 10, "daysSinceLastViolation": 400}, http.StatusNoContent, "X-Internal-Token", strings.Repeat("u", 32))
	applied := harness.expect("POST", "/api/v1/users/me/creator-application", token, nil, http.StatusCreated)
	if applied["creatorStatus"] != "pending" || applied["isCreator"] != false || applied["username"] != "ada.lovelace" {
		t.Fatalf("a creator with 500 to 999 followers goes to manual review: %v", applied)
	}
	harness.expect("POST", "/api/v1/users/me/creator-application", token, nil, http.StatusConflict)
	if listed := harness.expect("GET", "/api/v1/users/me/profiles", token, nil, http.StatusOK)["data"].([]any); len(listed) != 2 {
		t.Fatalf("a creator application must not add a profile: %v", listed)
	}
	harness.waitForPublishedEvents("businessProfile.created", "creatorApplication.submitted")
}
