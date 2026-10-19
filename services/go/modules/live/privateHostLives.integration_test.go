package live

import (
	"net/http"
	"testing"
)

func suggestedLiveIds(page map[string]any) map[string]bool {
	identifiers := map[string]bool{}
	items, _ := page["data"].([]any)
	for _, item := range items {
		if entry, isObject := item.(map[string]any); isObject {
			identifiers[entry["id"].(string)] = true
		}
	}
	return identifiers
}

func TestPrivateHostLivesStayWithAcceptedFollowers(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host, follower, stranger, blockedFollower := harness.newUser("privatehost", "creator"), harness.newUser("follower"), harness.newUser("stranger"), harness.newUser("blockedfollower")
	harness.relations.MakeAccountPrivate(host.id, true)
	harness.relations.Follow(follower.id, host.id)
	harness.relations.Follow(blockedFollower.id, host.id)
	harness.relations.Block(blockedFollower.id, host.id)
	liveId := harness.goLive(host, map[string]any{"visibility": "public", "startNow": true})
	statusPath := "/api/v1/users/" + host.id.String() + "/live"
	livePath := "/api/v1/lives/" + liveId

	for name, viewer := range map[string]*liveUser{"host": &host, "follower": &follower} {
		if status := harness.expect("GET", statusPath, viewer, "", nil, http.StatusOK); status["liveStreamId"] != liveId {
			t.Fatalf("%s should see the private host's live badge, got %v", name, status)
		}
		harness.expect("GET", livePath, viewer, "", nil, http.StatusOK)
	}
	harness.expect("POST", livePath+"/join", &follower, "", nil, http.StatusNoContent)
	if !suggestedLiveIds(harness.expect("GET", "/api/v1/lives/suggested", &follower, "", nil, http.StatusOK))[liveId] {
		t.Fatalf("an accepted follower is offered the private host's public live")
	}

	for name, viewer := range map[string]*liveUser{"stranger": &stranger, "blocked follower": &blockedFollower, "guest": nil} {
		if status := harness.expect("GET", statusPath, viewer, "", nil, http.StatusOK); status["liveStreamId"] != nil {
			t.Fatalf("%s must not see a private host's live badge, got %v", name, status)
		}
	}
	harness.expect("GET", livePath, &stranger, "", nil, http.StatusForbidden)
	harness.expect("GET", livePath, nil, "", nil, http.StatusForbidden)
	harness.expect("POST", livePath+"/join", &stranger, "", nil, http.StatusForbidden)
	harness.expect("POST", livePath+"/join", &blockedFollower, "", nil, http.StatusForbidden)
	if suggestedLiveIds(harness.expect("GET", "/api/v1/lives/suggested", &stranger, "", nil, http.StatusOK))[liveId] {
		t.Fatalf("a non-follower is never offered a private host's live")
	}

	harness.relations.MakeAccountPrivate(host.id, false)
	if status := harness.expect("GET", statusPath, nil, "", nil, http.StatusOK); status["liveStreamId"] != liveId {
		t.Fatalf("once the host is public a guest sees the public live, got %v", status)
	}
	harness.expect("POST", livePath+"/join", &stranger, "", nil, http.StatusNoContent)
}
