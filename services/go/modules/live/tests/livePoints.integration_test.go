package live_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestLikePointsCapAtTenPerMinuteAndPointsAreNotMoney(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	fan := harness.newUser("fan", "buyer")
	liveId := harness.goLive(host, nil)
	awarded := 0.0
	for range 14 {
		award := harness.expect("POST", "/api/v1/lives/"+liveId+"/engagement", &fan, "", map[string]any{"action": "like"}, http.StatusOK)
		awarded += award["awarded"].(float64)
	}
	if awarded != 10 {
		t.Fatalf("like points cap at 10 per minute, awarded %v", awarded)
	}
	mine := harness.expect("GET", "/api/v1/lives/"+liveId+"/points/me", &fan, "", nil, http.StatusOK)
	if mine["totalPoints"] != float64(10) || mine["likePointsThisMinute"] != float64(10) {
		t.Fatalf("unexpected points %v", mine)
	}
	harness.clock.Advance(2 * time.Minute)
	if again := harness.expect("POST", "/api/v1/lives/"+liveId+"/engagement", &fan, "", map[string]any{"action": "like"}, http.StatusOK); again["awarded"] != float64(1) {
		t.Fatalf("the cap resets after a minute: %v", again)
	}
	first := harness.expect("POST", "/api/v1/lives/"+liveId+"/engagement", &fan, "", map[string]any{"action": "share"}, http.StatusOK)["awarded"]
	second := harness.expect("POST", "/api/v1/lives/"+liveId+"/engagement", &fan, "", map[string]any{"action": "share"}, http.StatusOK)["awarded"]
	if first != float64(5) || second != float64(0) {
		t.Fatalf("share earns once per live: %v then %v", first, second)
	}
	harness.expect("POST", "/api/v1/lives/"+liveId+"/engagement", &fan, "", map[string]any{"action": "tip"}, http.StatusBadRequest)
	if len(harness.money.Charges) != 0 || len(harness.money.Balances) != 0 {
		t.Fatal("points must never touch the money gateway")
	}
}

func TestLeaderboardsRankByPointsKeepStreamHistoryAndGlobalRankings(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	big := harness.newUser("big", "buyer")
	small := harness.newUser("small", "buyer")
	liveId := harness.goLive(host, nil)
	send := func(user liveUser, giftId string, quantity int) {
		harness.expect("POST", "/api/v1/live/gifts", &user, uuid.NewString(), map[string]any{"liveId": liveId, "giftId": giftId, "quantity": quantity}, http.StatusCreated)
	}
	send(big, "gift_rose", 10)
	send(small, "gift_rose", 2)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/engagement", &small, "", map[string]any{"action": "follow"}, http.StatusOK)
	live := harness.expect("GET", "/api/v1/lives/"+liveId+"/leaderboard?limit=1", &small, "", nil, http.StatusOK)
	if len(live["data"].([]any)) != 1 || live["data"].([]any)[0].(map[string]any)["user"].(map[string]any)["id"] != big.id.String() || live["viewerRank"] != float64(2) || live["viewerPoints"] != float64(30) {
		t.Fatalf("unexpected live board %v", live)
	}
	recipient := harness.expect("GET", "/api/v1/lives/"+liveId+"/leaderboard?scope=recipient&receiverUserId="+host.id.String(), &small, "", nil, http.StatusOK)
	if len(recipient["data"].([]any)) != 2 {
		t.Fatalf("unexpected recipient board %v", recipient)
	}
	harness.expect("GET", "/api/v1/lives/"+liveId+"/leaderboard?scope=recipient", &small, "", nil, http.StatusBadRequest)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/end", &host, "", nil, http.StatusNoContent)
	stored := harness.expect("GET", "/api/v1/lives/"+liveId+"/leaderboard", &small, "", nil, http.StatusOK)["data"].([]any)
	if len(stored) != 2 || stored[0].(map[string]any)["user"].(map[string]any)["id"] != big.id.String() {
		t.Fatalf("the final board is kept after the live ends: %v", stored)
	}
	ended := harness.expect("GET", "/api/v1/lives/"+liveId, &small, "", nil, http.StatusOK)
	if ended["topSupporterUserId"] != big.id.String() {
		t.Fatalf("top supporter missing %v", ended)
	}
	harness.waitForEvent("live.topSupporterSelected")
	supporters := harness.expect("GET", "/api/v1/rankings?board=supporter&scope=global&period=all", &small, "", nil, http.StatusOK)["data"].([]any)
	if len(supporters) != 2 || supporters[0].(map[string]any)["rank"] != float64(1) || supporters[0].(map[string]any)["points"] != float64(100) {
		t.Fatalf("unexpected supporter ranking %v", supporters)
	}
	streamers := harness.expect("GET", "/api/v1/rankings?board=streamer&scope=category&categoryId=gaming", &small, "", nil, http.StatusOK)["data"].([]any)
	if len(streamers) != 1 || streamers[0].(map[string]any)["user"].(map[string]any)["id"] != host.id.String() {
		t.Fatalf("unexpected streamer ranking %v", streamers)
	}
	harness.expect("GET", "/api/v1/rankings?board=streamer&scope=country", &small, "", nil, http.StatusBadRequest)
	harness.expect("GET", "/api/v1/rankings?board=nonsense", &small, "", nil, http.StatusBadRequest)
}
