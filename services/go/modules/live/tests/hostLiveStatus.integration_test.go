package live_test

import (
	"net/http"
	"testing"
)

func TestProfileLiveStatusOnlyShowsLivesTheViewerMayWatch(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host, stranger, follower, blocked := harness.newUser("host", "creator"), harness.newUser("stranger"), harness.newUser("follower"), harness.newUser("blocked")
	statusPath := "/api/v1/users/" + host.id.String() + "/live"

	if status := harness.expect("GET", statusPath, &stranger, "", nil, http.StatusOK); status["liveStreamId"] != nil {
		t.Fatalf("a host who is not live has no live badge, got %v", status)
	}

	liveId := harness.goLive(host, map[string]any{"visibility": "followers", "startNow": true})
	harness.relations.Follow(follower.id, host.id)
	harness.relations.Block(host.id, blocked.id)

	for name, viewer := range map[string]*liveUser{"host": &host, "follower": &follower} {
		status := harness.expect("GET", statusPath, viewer, "", nil, http.StatusOK)
		if status["liveStreamId"] != liveId || status["startedAt"] == nil {
			t.Fatalf("%s should see the followers-only live %s, got %v", name, liveId, status)
		}
	}
	for name, viewer := range map[string]*liveUser{"stranger": &stranger, "blocked": &blocked, "guest": nil} {
		if status := harness.expect("GET", statusPath, viewer, "", nil, http.StatusOK); status["liveStreamId"] != nil {
			t.Fatalf("%s must not see a followers-only live, got %v", name, status)
		}
	}

	harness.expect("POST", "/api/v1/lives/"+liveId+"/end", &host, "", nil, http.StatusNoContent)
	publicLiveId := harness.goLive(host, map[string]any{"visibility": "public", "startNow": true})
	if status := harness.expect("GET", statusPath, nil, "", nil, http.StatusOK); status["liveStreamId"] != publicLiveId {
		t.Fatalf("guests see a public live, got %v want %s", status, publicLiveId)
	}
	if status := harness.expect("GET", statusPath, &blocked, "", nil, http.StatusOK); status["liveStreamId"] != nil {
		t.Fatalf("a blocked viewer never sees the live badge, got %v", status)
	}

	harness.expect("POST", "/api/v1/lives/"+publicLiveId+"/end", &host, "", nil, http.StatusNoContent)
	if status := harness.expect("GET", statusPath, &stranger, "", nil, http.StatusOK); status["liveStreamId"] != nil {
		t.Fatalf("an ended live drops the badge, got %v", status)
	}
	harness.expect("GET", "/api/v1/users/not-a-uuid/live", &stranger, "", nil, http.StatusBadRequest)
}
