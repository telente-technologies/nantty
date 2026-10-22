package users

import (
	"net/http"
	"strings"
	"testing"
)

func TestProfileLifecyclePrivacyAndMedia(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	adaId, adaToken := harness.newAccount("ada.lovelace", "Ada Lovelace")
	_, graceToken := harness.newAccount("grace.hopper", "Grace Hopper")

	harness.expect("GET", "/api/v1/users/me", "", nil, http.StatusUnauthorized)
	mine := harness.expect("GET", "/api/v1/users/me", adaToken, nil, http.StatusOK)
	if mine["id"] != adaId || mine["username"] != "ada.lovelace" || mine["email"] != "ada.lovelace@example.com" || mine["isPrivate"] != false || mine["verified"] != false {
		t.Fatalf("unexpected own profile %v", mine)
	}

	intent := harness.expect("POST", "/api/v1/users/me/media/upload-intents", adaToken, map[string]any{"purpose": "avatar", "contentType": "image/png", "sizeBytes": 1024}, http.StatusCreated)
	mediaId := intent["mediaId"].(string)
	if !strings.HasPrefix(mediaId, "users/"+adaId+"/avatar/") || !strings.Contains(intent["uploadUrl"].(string), "signature=") || intent["placeholder"] != true {
		t.Fatalf("unexpected upload intent %v", intent)
	}
	harness.expect("POST", "/api/v1/users/me/media/upload-intents", adaToken, map[string]any{"purpose": "avatar", "contentType": "image/gif", "sizeBytes": 1024}, http.StatusUnprocessableEntity)
	harness.expect("POST", "/api/v1/users/me/media/upload-intents", adaToken, map[string]any{"purpose": "avatar", "contentType": "image/png", "sizeBytes": 50 * 1024 * 1024}, http.StatusUnprocessableEntity)

	updated := harness.expect("PATCH", "/api/v1/users/me", adaToken, map[string]any{
		"name": "Ada King", "bio": "First programmer", "isPrivate": true, "avatarMediaId": mediaId, "bannerUrl": "https://cdn.example.com/banner.png",
	}, http.StatusOK)
	if updated["name"] != "Ada King" || updated["isPrivate"] != true || updated["avatarUrl"] != "https://media.zudomart.test/"+mediaId || updated["bannerUrl"] != "https://cdn.example.com/banner.png" {
		t.Fatalf("unexpected update %v", updated)
	}
	harness.expect("PATCH", "/api/v1/users/me", adaToken, map[string]any{"avatarMediaId": "users/someone-else/avatar/x.png"}, http.StatusUnprocessableEntity)
	harness.expect("PATCH", "/api/v1/users/me", adaToken, map[string]any{"bannerUrl": "javascript:alert(1)"}, http.StatusUnprocessableEntity)
	harness.expect("PATCH", "/api/v1/users/me", adaToken, map[string]any{"verified": true}, http.StatusBadRequest)
	cleared := harness.expect("PATCH", "/api/v1/users/me", adaToken, map[string]any{"bannerUrl": nil}, http.StatusOK)
	if cleared["bannerUrl"] != nil {
		t.Fatalf("banner should be cleared: %v", cleared)
	}

	seenByGrace := harness.expect("GET", "/api/v1/users/"+adaId, graceToken, nil, http.StatusOK)
	if seenByGrace["email"] != nil || seenByGrace["roles"] != nil || seenByGrace["birthday"] != nil || seenByGrace["isPrivate"] != true || seenByGrace["username"] != "ada.lovelace" {
		t.Fatalf("other users must not see private fields: %v", seenByGrace)
	}
	byUsername := harness.expect("GET", "/api/v1/users/username/Ada.Lovelace", graceToken, nil, http.StatusOK)
	if byUsername["id"] != adaId {
		t.Fatalf("lookup by username failed: %v", byUsername)
	}
	harness.expect("GET", "/api/v1/users/username/nobody.here", graceToken, nil, http.StatusNotFound)
	harness.expect("GET", "/api/v1/users/not-a-uuid", graceToken, nil, http.StatusNotFound)

	harness.expect("PATCH", "/api/v1/users/me/preferences", adaToken, map[string]any{"countryCode": "ng"}, http.StatusNoContent)
	harness.expect("PATCH", "/api/v1/users/me/preferences", adaToken, map[string]any{"countryCode": "N1"}, http.StatusUnprocessableEntity)
	if refreshed := harness.expect("GET", "/api/v1/users/me", adaToken, nil, http.StatusOK); refreshed["countryCode"] != "NG" {
		t.Fatalf("country preference not stored: %v", refreshed)
	}
	harness.waitForPublishedEvents("profile.updated", "profile.visibilityChanged")
}

func TestDeactivatedAccountsCannotBeViewed(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, adaToken := harness.newAccount("leaving.user", "Leaving User")
	targetId, _ := harness.newAccount("other.user", "Other User")
	harness.expect("GET", "/api/v1/users/"+targetId, adaToken, nil, http.StatusOK)
	harness.expect("POST", "/api/v1/users/me/deactivate", adaToken, nil, http.StatusNoContent)
	if !harness.audit.has("user.deactivated") {
		t.Fatalf("deactivation is audited: %v", harness.audit.actions)
	}
	harness.expect("GET", "/api/v1/users/me", adaToken, nil, http.StatusUnauthorized)
}
