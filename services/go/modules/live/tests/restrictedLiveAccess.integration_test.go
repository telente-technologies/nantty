package live_test

import (
	"net/http"
	"testing"
)

func assertLockedLive(t *testing.T, name string, view map[string]any, reason string) {
	t.Helper()
	access, _ := view["access"].(map[string]any)
	if access == nil || access["allowed"] != false || access["reason"] != reason {
		t.Fatalf("%s gets a locked live with reason %s: %v", name, reason, view["access"])
	}
	media, _ := view["media"].(map[string]any)
	if view["playbackUrl"] != nil || media == nil || media["livekitUrl"] != "" || view["safety"] != nil || view["hostRanking"] != nil || view["liveAdSettings"] != nil || view["storeId"] != nil {
		t.Fatalf("%s must get no playback or media details: %v", name, view)
	}
	if view["title"] == "" || view["visibility"] == nil || view["host"] == nil {
		t.Fatalf("%s still gets what the locked state needs: %v", name, view)
	}
}

func assertOpenLive(t *testing.T, name string, view map[string]any) {
	t.Helper()
	access, _ := view["access"].(map[string]any)
	media, _ := view["media"].(map[string]any)
	if access == nil || access["allowed"] != true || media == nil || media["livekitUrl"] != "ws://localhost:7880" {
		t.Fatalf("%s may watch: %v %v", name, view["access"], view["media"])
	}
}

func TestRestrictedLivesOfAPublicHostHandOutNoPlaybackToIneligibleViewers(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host, follower, subscriber, stranger, blocked := harness.newUser("publichost", "creator"), harness.newUser("fan"), harness.newUser("subscriber"), harness.newUser("stranger"), harness.newUser("blocked")
	harness.relations.Follow(follower.id, host.id)
	harness.relations.Follow(subscriber.id, host.id)
	harness.relations.Subscribe(subscriber.id, host.id)
	harness.relations.Follow(blocked.id, host.id)
	harness.relations.Block(host.id, blocked.id)
	followersLive := "/api/v1/lives/" + harness.goLive(host, map[string]any{"visibility": "followers", "startNow": true, "title": "Fans only"})

	assertLockedLive(t, "stranger", harness.expect("GET", followersLive, &stranger, "", nil, http.StatusOK), "followersOnly")
	assertLockedLive(t, "guest", harness.expect("GET", followersLive, nil, "", nil, http.StatusOK), "followersOnly")
	assertOpenLive(t, "follower", harness.expect("GET", followersLive, &follower, "", nil, http.StatusOK))
	assertOpenLive(t, "host", harness.expect("GET", followersLive, &host, "", nil, http.StatusOK))
	harness.expect("GET", followersLive, &blocked, "", nil, http.StatusForbidden)
	harness.expect("POST", followersLive+"/media-token", &stranger, "", nil, http.StatusForbidden)
	harness.expect("POST", followersLive+"/media-token", &blocked, "", nil, http.StatusForbidden)
	if token := harness.expect("POST", followersLive+"/media-token", &follower, "", nil, http.StatusOK); token["token"] == "" {
		t.Fatalf("a follower gets a media token: %v", token)
	}
	harness.expect("POST", followersLive+"/join", &stranger, "", nil, http.StatusForbidden)

	other := harness.newUser("otherhost", "creator")
	harness.relations.Follow(follower.id, other.id)
	harness.relations.Follow(subscriber.id, other.id)
	harness.relations.Subscribe(subscriber.id, other.id)
	subscribersLive := "/api/v1/lives/" + harness.goLive(other, map[string]any{"visibility": "subscribers", "startNow": true, "title": "Members only"})
	assertLockedLive(t, "follower without a subscription", harness.expect("GET", subscribersLive, &follower, "", nil, http.StatusOK), "subscribersOnly")
	assertLockedLive(t, "guest", harness.expect("GET", subscribersLive, nil, "", nil, http.StatusOK), "subscribersOnly")
	assertOpenLive(t, "subscriber", harness.expect("GET", subscribersLive, &subscriber, "", nil, http.StatusOK))
	harness.expect("POST", subscribersLive+"/media-token", &follower, "", nil, http.StatusForbidden)
	harness.expect("POST", subscribersLive+"/media-token", &subscriber, "", nil, http.StatusOK)

	publicLive := "/api/v1/lives/" + harness.goLive(harness.newUser("openhost", "creator"), map[string]any{"visibility": "public", "startNow": true})
	assertOpenLive(t, "guest on a public live", harness.expect("GET", publicLive, nil, "", nil, http.StatusOK))
}
