package live_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
)

func TestLiveSessionCarriesHostGlobalAndCategoryRank(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	leader := harness.newUser("leader", "creator")
	runnerUp := harness.newUser("runnerUp", "creator")
	unranked := harness.newUser("unranked", "creator")
	fan := harness.newUser("fan", "buyer")
	leaderLive := harness.goLive(leader, nil)
	runnerUpLive := harness.goLive(runnerUp, map[string]any{"category": "music"})
	unrankedLive := harness.goLive(unranked, nil)
	send := func(liveId string, quantity int) {
		harness.expect("POST", "/api/v1/live/gifts", &fan, uuid.NewString(), map[string]any{"liveId": liveId, "giftId": "gift_rose", "quantity": quantity}, http.StatusCreated)
	}
	send(leaderLive, 5)
	send(runnerUpLive, 2)

	leaderRanking, _ := harness.expect("GET", "/api/v1/lives/"+leaderLive, &fan, "", nil, http.StatusOK)["hostRanking"].(map[string]any)
	if leaderRanking["globalRank"] != float64(1) || leaderRanking["categoryRank"] != float64(1) || leaderRanking["category"] != "gaming" || leaderRanking["period"] != "week" {
		t.Fatalf("unexpected leader ranking %v", leaderRanking)
	}
	runnerUpRanking, _ := harness.expect("GET", "/api/v1/lives/"+runnerUpLive, &fan, "", nil, http.StatusOK)["hostRanking"].(map[string]any)
	if runnerUpRanking["globalRank"] != float64(2) || runnerUpRanking["categoryRank"] != float64(1) || runnerUpRanking["category"] != "music" {
		t.Fatalf("unexpected runner-up ranking %v", runnerUpRanking)
	}
	unrankedSession := harness.expect("GET", "/api/v1/lives/"+unrankedLive, &fan, "", nil, http.StatusOK)
	if value, present := unrankedSession["hostRanking"]; !present || value != nil {
		t.Fatalf("a host with no points has a null hostRanking, got %v", value)
	}
}
