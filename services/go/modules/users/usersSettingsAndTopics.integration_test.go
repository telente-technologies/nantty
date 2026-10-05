package users

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"
)

func (harness *usersTestHarness) expectList(method, path, accessToken string, body any, wantStatus int) []map[string]any {
	harness.t.Helper()
	encoded := []byte{}
	if body != nil {
		encoded, _ = json.Marshal(body)
	}
	request, _ := http.NewRequest(method, harness.server.URL+path, bytes.NewReader(encoded))
	request.Header.Set("Content-Type", "application/json")
	if accessToken != "" {
		request.Header.Set("Authorization", "Bearer "+accessToken)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		harness.t.Fatal(err)
	}
	defer response.Body.Close()
	items := []map[string]any{}
	_ = json.NewDecoder(response.Body).Decode(&items)
	if response.StatusCode != wantStatus {
		harness.t.Fatalf("%s %s = %d, want %d", method, path, response.StatusCode, wantStatus)
	}
	return items
}

func TestTopicsCatalogueSelectionAndEvent(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, token := harness.newAccount("topic.fan", "Topic Fan")
	catalogue := harness.expectList("GET", "/api/v1/topics", "", nil, http.StatusOK)
	if len(catalogue) < 10 || catalogue[0]["id"] != "fashion" || catalogue[0]["slug"] != "fashion" || catalogue[0]["name"] != "Fashion" {
		t.Fatalf("the seeded catalogue is public and uses slugs as ids: %v", catalogue)
	}
	if mine := harness.expectList("GET", "/api/v1/users/me/topics", token, nil, http.StatusOK); len(mine) != 0 {
		t.Fatalf("nothing is selected yet: %v", mine)
	}
	harness.expect("PUT", "/api/v1/users/me/topics", token, map[string]any{"topicIds": []string{"fashion", "music"}}, http.StatusBadRequest)
	harness.expect("PUT", "/api/v1/users/me/topics", token, map[string]any{"topicIds": []string{"fashion", "music", "fashion"}}, http.StatusBadRequest)
	harness.expect("PUT", "/api/v1/users/me/topics", token, map[string]any{"topicIds": []string{"fashion", "music", "not-a-topic"}}, http.StatusUnprocessableEntity)
	harness.expect("PUT", "/api/v1/users/me/topics", "", map[string]any{"topicIds": []string{"fashion", "music", "food"}}, http.StatusUnauthorized)
	saved := harness.expectList("PUT", "/api/v1/users/me/topics", token, map[string]any{"topicIds": []string{"music", "fashion", "food"}}, http.StatusOK)
	if len(saved) != 3 {
		t.Fatalf("three topics are saved: %v", saved)
	}
	harness.expectList("PUT", "/api/v1/users/me/topics", token, map[string]any{"topicIds": []string{"travel", "tech", "deals", "kids"}}, http.StatusOK)
	mine := harness.expectList("GET", "/api/v1/users/me/topics", token, nil, http.StatusOK)
	if len(mine) != 4 || mine[0]["id"] != "tech" {
		t.Fatalf("saving replaces the previous selection: %v", mine)
	}
	harness.waitForPublishedEvents("topics.selected")
}

func TestAccountSettingsAndMarketingPreferences(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, token := harness.newAccount("settings.owner", "Settings Owner")
	settings := harness.expect("GET", "/api/v1/users/me/settings", token, nil, http.StatusOK)
	if settings["email"] != "settings.owner@example.com" || settings["theme"] != "system" || settings["language"] != "en" ||
		settings["pushNotificationsEnabled"] != true || settings["twoFactorEnabled"] != false || settings["phone"] != nil || settings["countryCode"] != nil {
		t.Fatalf("unexpected default settings %v", settings)
	}
	updated := harness.expect("PATCH", "/api/v1/users/me/settings", token, map[string]any{"theme": "dark", "countryCode": "ng", "pushNotificationsEnabled": false}, http.StatusOK)
	if updated["theme"] != "dark" || updated["countryCode"] != "NG" || updated["pushNotificationsEnabled"] != false {
		t.Fatalf("settings were not saved: %v", updated)
	}
	harness.expect("PATCH", "/api/v1/users/me/settings", token, map[string]any{"twoFactorEnabled": true}, http.StatusUnprocessableEntity)
	harness.expect("PATCH", "/api/v1/users/me/settings", token, map[string]any{"email": "other@example.com"}, http.StatusUnprocessableEntity)
	harness.expect("PATCH", "/api/v1/users/me/settings", token, map[string]any{"phone": "+2348000000000"}, http.StatusBadRequest)
	harness.expect("PATCH", "/api/v1/users/me/settings", token, map[string]any{"language": "fr"}, http.StatusBadRequest)
	if preferences := harness.expect("GET", "/api/v1/users/me/marketing-preferences", token, nil, http.StatusOK); preferences["frequency"] != "weekly" {
		t.Fatalf("weekly is the default frequency: %v", preferences)
	}
	harness.expect("PUT", "/api/v1/users/me/marketing-preferences", token, map[string]any{"frequency": "daily"}, http.StatusBadRequest)
	harness.expect("PUT", "/api/v1/users/me/marketing-preferences", token, map[string]any{"frequency": "important_only"}, http.StatusOK)
	if preferences := harness.expect("GET", "/api/v1/users/me/marketing-preferences", token, nil, http.StatusOK); preferences["frequency"] != "important_only" {
		t.Fatalf("the frequency was not stored: %v", preferences)
	}
}

func TestPublicProfileByIdAndProfileSitemap(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	publicId, _ := harness.newAccount("open.profile", "Open Profile")
	_, privateToken := harness.newAccount("closed.profile", "Closed Profile")
	harness.expect("PATCH", "/api/v1/users/me", privateToken, map[string]any{"isPrivate": true}, http.StatusOK)
	viewed := harness.expect("GET", "/api/v1/users/"+publicId, "", nil, http.StatusOK)
	if viewed["username"] != "open.profile" || viewed["email"] != nil {
		t.Fatalf("guests get the public view without private fields: %v", viewed)
	}
	harness.expect("GET", "/api/v1/users/not-a-uuid", "", nil, http.StatusNotFound)
	page := harness.expect("GET", "/api/v1/sitemap/profiles?page=0", "", nil, http.StatusOK)
	entries := page["entries"].([]any)
	if page["totalPages"] != float64(1) || len(entries) != 1 || entries[0].(map[string]any)["name"] != "open.profile" || entries[0].(map[string]any)["id"] != publicId {
		t.Fatalf("the sitemap lists public profiles only: %v", page)
	}
	if empty := harness.expect("GET", "/api/v1/sitemap/profiles?page=4", "", nil, http.StatusOK); len(empty["entries"].([]any)) != 0 {
		t.Fatalf("a page past the end is empty: %v", empty)
	}
	harness.expect("GET", "/api/v1/sitemap/profiles?page=-1", "", nil, http.StatusBadRequest)
}
