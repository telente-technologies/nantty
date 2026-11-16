package live_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"testing"
)

func (harness *liveHarness) internalCall(method, path, token string, body any) (int, map[string]any) {
	harness.t.Helper()
	var reader io.Reader
	if body != nil {
		encoded, _ := json.Marshal(body)
		reader = bytes.NewReader(encoded)
	}
	request, _ := http.NewRequest(method, harness.server.URL+path, reader)
	request.Header.Set("Content-Type", "application/json")
	if token != "" {
		request.Header.Set("X-Internal-Token", token)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		harness.t.Fatal(err)
	}
	defer response.Body.Close()
	decoded := map[string]any{}
	_ = json.NewDecoder(response.Body).Decode(&decoded)
	return response.StatusCode, decoded
}

func (harness *liveHarness) internalOk(method, path string, body any) map[string]any {
	harness.t.Helper()
	status, decoded := harness.internalCall(method, path, testInternalToken, body)
	if status != http.StatusOK && status != http.StatusNoContent {
		harness.t.Fatalf("%s %s = %d %v", method, path, status, decoded)
	}
	return decoded
}

func TestInternalEndpointsRequireTheInternalToken(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	liveId := harness.goLive(host, nil)
	paths := []string{"/api/v1/internal/share-cards/live/" + liveId, "/api/v1/internal/live/topic-access?userId=" + host.id.String() + "&topic=live:" + liveId, "/api/v1/internal/live/" + liveId + "/ad-eligibility"}
	for _, path := range paths {
		if status, _ := harness.internalCall("GET", path, "", nil); status != http.StatusUnauthorized {
			t.Fatalf("%s without a token = %d", path, status)
		}
		if status, _ := harness.internalCall("GET", path, "not-the-token", nil); status != http.StatusUnauthorized {
			t.Fatalf("%s with a wrong token = %d", path, status)
		}
	}
	if status, _ := harness.internalCall("POST", "/api/v1/internal/live/"+liveId+"/presence", "", map[string]any{"joined": []string{}}); status != http.StatusUnauthorized {
		t.Fatalf("presence without a token = %d", status)
	}
}

func TestShareCardForLiveShowsHostViewersStatusAndRespectsPrivacy(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	viewer := harness.newUser("viewer", "buyer")
	stranger := harness.newUser("stranger", "buyer")
	liveId := harness.goLive(host, map[string]any{"title": "Sunday pots", "visibility": "followers"})
	harness.relations.Follow(viewer.id, host.id)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/join", &viewer, "", nil, http.StatusNoContent)
	card := harness.internalOk("GET", "/api/v1/internal/share-cards/live/"+liveId+"?viewerId="+viewer.id.String(), nil)
	if card["availability"] != "available" || card["title"] != "Sunday pots" || card["subtitle"] != "host" || card["isLive"] != true || card["status"] != "LIVE" || card["viewerCount"] != float64(1) {
		t.Fatalf("unexpected card %v", card)
	}
	if card["host"].(map[string]any)["id"] != host.id.String() {
		t.Fatalf("card must name the host %v", card)
	}
	private := harness.internalOk("GET", "/api/v1/internal/share-cards/live/"+liveId+"?viewerId="+stranger.id.String(), nil)
	if private["availability"] != "private" || private["title"] != nil {
		t.Fatalf("followers-only lives are private to strangers: %v", private)
	}
	harness.relations.Block(host.id, viewer.id)
	if blocked := harness.internalOk("GET", "/api/v1/internal/share-cards/live/"+liveId+"?viewerId="+viewer.id.String(), nil); blocked["availability"] != "unavailable" {
		t.Fatalf("a blocked viewer must not learn the live exists: %v", blocked)
	}
	if missing := harness.internalOk("GET", "/api/v1/internal/share-cards/live/6f1d3a52-0b0e-4c0e-9d57-1a2b3c4d5e6f?viewerId="+viewer.id.String(), nil); missing["availability"] != "unavailable" {
		t.Fatalf("missing live %v", missing)
	}
	harness.expect("POST", "/api/v1/lives/"+liveId+"/end", &host, "", nil, http.StatusNoContent)
	ended := harness.internalOk("GET", "/api/v1/internal/share-cards/live/"+liveId+"?viewerId="+host.id.String(), nil)
	if ended["isLive"] != false || ended["status"] != "ENDED" || ended["viewerCount"] != nil {
		t.Fatalf("ended card %v", ended)
	}
}

func TestTopicAccessCoversBlockedPrivateSubscriberOnlyAndBanned(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	fan := harness.newUser("fan", "buyer")
	follower := harness.newUser("follower", "buyer")
	stranger := harness.newUser("stranger", "buyer")
	publicLive := harness.goLive(host, nil)
	access := func(user liveUser, topic string) map[string]any {
		return harness.internalOk("GET", "/api/v1/internal/live/topic-access?userId="+user.id.String()+"&topic="+topic, nil)
	}
	if decision := access(stranger, "live:"+publicLive); decision["allowed"] != true || decision["role"] != "viewer" {
		t.Fatalf("public lives are open %v", decision)
	}
	if decision := access(host, "live:"+publicLive); decision["role"] != "host" {
		t.Fatalf("host role %v", decision)
	}
	for _, topic := range []string{"live:not-a-uuid", "user:" + stranger.id.String(), "live:6f1d3a52-0b0e-4c0e-9d57-1a2b3c4d5e6f"} {
		if decision := access(stranger, topic); decision["allowed"] != false {
			t.Fatalf("%s must be denied %v", topic, decision)
		}
	}
	harness.relations.Block(host.id, stranger.id)
	if decision := access(stranger, "live:"+publicLive); decision["allowed"] != false || decision["reason"] != "blocked" {
		t.Fatalf("blocked viewers are denied %v", decision)
	}
	harness.expect("POST", "/api/v1/lives/"+publicLive+"/end", &host, "", nil, http.StatusNoContent)
	followersLive := harness.goLive(host, map[string]any{"visibility": "followers"})
	harness.relations.Follow(follower.id, host.id)
	if decision := access(follower, "live:"+followersLive); decision["allowed"] != true {
		t.Fatalf("followers may join %v", decision)
	}
	if decision := access(fan, "live:"+followersLive); decision["allowed"] != false || decision["reason"] != "followersOnly" {
		t.Fatalf("non followers are denied %v", decision)
	}
	harness.expect("POST", "/api/v1/lives/"+followersLive+"/join", &fan, "", nil, http.StatusForbidden)
	harness.expect("POST", "/api/v1/lives/"+followersLive+"/end", &host, "", nil, http.StatusNoContent)
	subscribersLive := harness.goLive(host, map[string]any{"visibility": "subscribers"})
	harness.relations.Subscribe(fan.id, host.id)
	if decision := access(fan, "live:"+subscribersLive); decision["allowed"] != true {
		t.Fatalf("subscribers may join %v", decision)
	}
	if decision := access(follower, "live:"+subscribersLive); decision["allowed"] != false || decision["reason"] != "subscribersOnly" {
		t.Fatalf("followers are not subscribers %v", decision)
	}
	harness.expect("PUT", "/api/v1/lives/"+subscribersLive+"/viewers/"+fan.id.String()+"/ban", &host, "", nil, http.StatusOK)
	if decision := access(fan, "live:"+subscribersLive); decision["allowed"] != false || decision["reason"] != "banned" {
		t.Fatalf("banned subscribers are denied %v", decision)
	}
	if status, decision := harness.internalCall("GET", "/api/v1/internal/live/topic-access?userId=nope&topic=live:"+subscribersLive, testInternalToken, nil); status != http.StatusOK || decision["allowed"] != false {
		t.Fatalf("unknown users are denied %v", decision)
	}
}

func TestPresenceFromPhoenixDrivesViewerCountAndPeak(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	viewers := []liveUser{harness.newUser("a", "buyer"), harness.newUser("b", "buyer"), harness.newUser("c", "buyer")}
	liveId := harness.goLive(host, nil)
	path := "/api/v1/internal/live/" + liveId + "/presence"
	ids := func(users ...liveUser) []string {
		listed := make([]string, 0, len(users))
		for _, user := range users {
			listed = append(listed, user.id.String())
		}
		return listed
	}
	harness.internalOk("POST", path, map[string]any{"joined": append(ids(viewers...), host.id.String(), ids(viewers[0])[0])})
	read := func() map[string]any {
		return harness.expect("GET", "/api/v1/lives/"+liveId, &host, "", nil, http.StatusOK)
	}
	if current := read(); current["viewers"] != float64(3) || current["peakViewers"] != float64(3) {
		t.Fatalf("host and duplicates are not viewers: %v", current)
	}
	harness.internalOk("POST", path, map[string]any{"left": ids(viewers[0], viewers[1])})
	if current := read(); current["viewers"] != float64(1) || current["peakViewers"] != float64(3) {
		t.Fatalf("peak is kept after people leave: %v", current)
	}
	harness.internalOk("POST", path, map[string]any{"joined": ids(viewers[0]), "left": ids(viewers[0])})
	if current := read(); current["viewers"] != float64(2) {
		t.Fatalf("a user in both lists is still present: %v", current)
	}
	harness.waitForEvent("live.viewerCountChanged")
	if status, _ := harness.internalCall("POST", path, testInternalToken, map[string]any{"joined": []string{"nope"}}); status != http.StatusUnprocessableEntity {
		t.Fatalf("invalid ids rejected, got %d", status)
	}
	harness.expect("POST", "/api/v1/lives/"+liveId+"/end", &host, "", nil, http.StatusNoContent)
	harness.internalOk("POST", path, map[string]any{"joined": ids(viewers[2])})
	if current := read(); current["viewers"] != float64(0) {
		t.Fatalf("an ended live ignores late presence: %v", current)
	}
}

func TestLiveAdTermsAreEnforcedAtStartAndEligibilityIsReported(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	adSettings := map[string]any{"allowAds": true, "placements": []string{"naturalBreak"}, "maxInterruptions": 2, "minIntervalMinutes": 10, "showAdIndicator": true}
	harness.expect("POST", "/api/v1/lives", &host, "", map[string]any{"title": "Ads", "category": "gaming", "startNow": false, "liveAdSettings": adSettings}, http.StatusUnprocessableEntity)
	harness.expect("POST", "/api/v1/lives", &host, "", map[string]any{"title": "Ads", "category": "gaming", "startNow": false, "liveAdSettings": adSettings, "acceptedLiveAdTermsVersion": "1999-01"}, http.StatusUnprocessableEntity)
	created := harness.expect("POST", "/api/v1/lives", &host, "", map[string]any{"title": "Ads", "category": "gaming", "startNow": false, "liveAdSettings": adSettings, "acceptedLiveAdTermsVersion": "2026-10"}, http.StatusCreated)
	liveId := created["id"].(string)
	if created["acceptedLiveAdTermsVersion"] != "2026-10" {
		t.Fatalf("terms version not stored %v", created)
	}
	notLive := harness.internalOk("GET", "/api/v1/internal/live/"+liveId+"/ad-eligibility", nil)
	if notLive["eligible"] != false || notLive["reason"] != "notLive" {
		t.Fatalf("eligibility before start %v", notLive)
	}
	harness.module.Container.Settings.LiveAdTermsCurrentVersion = "2026-12"
	outdated := harness.expect("POST", "/api/v1/lives/"+liveId+"/start", &host, "", nil, http.StatusUnprocessableEntity)
	if outdated["code"] != "LIVE_AD_TERMS_OUTDATED" {
		t.Fatalf("starting with outdated terms must be refused %v", outdated)
	}
	harness.expect("PUT", "/api/v1/lives/"+liveId+"/monetization", &host, "", map[string]any{"liveAdSettings": adSettings, "acceptedLiveAdTermsVersion": "2026-12"}, http.StatusOK)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/start", &host, "", nil, http.StatusOK)
	eligible := harness.internalOk("GET", "/api/v1/internal/live/"+liveId+"/ad-eligibility", nil)
	if eligible["eligible"] != true || eligible["maxInterruptions"] != float64(2) || eligible["placements"].([]any)[0] != "naturalBreak" {
		t.Fatalf("eligibility after start %v", eligible)
	}
	harness.waitForEvent("live.started")
	var startedEvent map[string]any
	for _, published := range harness.publisher.Published {
		if published.EventType == "live.started" {
			_ = json.Unmarshal(published.Payload, &startedEvent)
		}
	}
	data, _ := startedEvent["data"].(map[string]any)
	if data["visibility"] != "public" || data["notifyAudience"] != "followers" || data["startedAt"] == nil {
		t.Fatalf("live.started must carry what notifications need: %v", startedEvent)
	}
}

func TestLiveStartedCarriesOnlyOptedInUnblockedFollowersForNotifications(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator", "seller")
	follower := harness.newUser("follower", "buyer")
	optedOut := harness.newUser("optedout", "buyer")
	blocked := harness.newUser("blocked", "buyer")
	harness.relations.Follow(follower.id, host.id)
	harness.relations.Follow(optedOut.id, host.id)
	harness.relations.Follow(blocked.id, host.id)
	harness.relations.OptOutOfLiveAlerts(optedOut.id)
	harness.relations.Block(host.id, blocked.id)
	harness.goLive(host, map[string]any{"title": "Ranked grind", "category": "shopping"})
	harness.waitForEvent("live.started")
	var data map[string]any
	for _, published := range harness.publisher.Published {
		if published.EventType == "live.started" {
			var envelope map[string]any
			_ = json.Unmarshal(published.Payload, &envelope)
			data, _ = envelope["data"].(map[string]any)
		}
	}
	recipients, _ := data["notifyUserIds"].([]any)
	if len(recipients) != 1 || recipients[0] != follower.id.String() || data["hostName"] != "host" || data["isShopping"] != true || data["notifyTruncated"] != false {
		t.Fatalf("live.started recipients wrong: %v", data)
	}
	if data["host"].(map[string]any)["id"] != host.id.String() {
		t.Fatalf("live.started must carry the host actor: %v", data)
	}
}
