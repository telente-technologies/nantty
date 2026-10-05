package live

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestGuestsReadALiveAndTheHostCarriesFollowCounts(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	fan, other := harness.newUser("fan", "buyer"), harness.newUser("other", "buyer")
	harness.relations.Follow(fan.id, host.id)
	harness.relations.Follow(other.id, host.id)
	harness.relations.Follow(host.id, fan.id)
	liveId := harness.goLive(host, nil)
	live := harness.expect("GET", "/api/v1/lives/"+liveId, nil, "", nil, http.StatusOK)
	hostView := live["host"].(map[string]any)
	if live["id"] != liveId || hostView["followers"] != float64(2) || hostView["following"] != float64(1) {
		t.Fatalf("guest view must carry the host follow counts: %v", live)
	}
	forged := liveUser{token: "not-a-token"}
	harness.expect("GET", "/api/v1/lives/"+liveId, &forged, "", nil, http.StatusUnauthorized)
	harness.expect("GET", "/api/v1/lives/"+uuid.NewString(), nil, "", nil, http.StatusNotFound)
	harness.expect("GET", "/api/v1/lives/"+liveId+"/comments", nil, "", nil, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/join", nil, "", nil, http.StatusUnauthorized)
}

func TestHostPinsAndUnpinsProductsAndViewersCannot(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	seller := harness.newUser("seller", "creator", "seller")
	viewer := harness.newUser("viewer", "buyer", "seller")
	liveId := harness.expect("POST", "/api/v1/lives", &seller, "", map[string]any{"title": "Flash sale", "category": "shopping"}, http.StatusCreated)["id"].(string)
	first, second := uuid.NewString(), uuid.NewString()
	harness.expect("POST", "/api/v1/lives/"+liveId+"/pins", &viewer, "", map[string]any{"productId": first}, http.StatusForbidden)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/pins", &seller, "", map[string]any{"productId": first}, http.StatusOK)
	pinned := harness.expect("POST", "/api/v1/lives/"+liveId+"/pins", &seller, "", map[string]any{"productId": second}, http.StatusOK)["data"].([]any)
	if len(pinned) != 2 || pinned[0].(map[string]any)["pinned"] != false || pinned[1].(map[string]any)["pinned"] != true {
		t.Fatalf("only the newest pin stays on screen: %v", pinned)
	}
	harness.expect("DELETE", "/api/v1/lives/"+liveId+"/pins", &viewer, "", nil, http.StatusForbidden)
	cleared := harness.expect("DELETE", "/api/v1/lives/"+liveId+"/pins", &seller, "", nil, http.StatusOK)["data"].([]any)
	for _, entry := range cleared {
		if entry.(map[string]any)["pinned"] != false {
			t.Fatalf("unpin must clear every pin: %v", cleared)
		}
	}
	if live := harness.expect("GET", "/api/v1/lives/"+liveId, &viewer, "", nil, http.StatusOK); live["pinnedProductId"] != nil {
		t.Fatalf("the live must stop showing a pinned product: %v", live)
	}
	harness.expect("DELETE", "/api/v1/lives/"+liveId+"/pins", &seller, "", nil, http.StatusOK)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/end", &seller, "", nil, http.StatusNoContent)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/pins", &seller, "", map[string]any{"productId": first}, http.StatusConflict)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/comments", &viewer, "", map[string]any{"text": "late"}, http.StatusConflict)
}

func TestGiftGoalEditsHonourTheGiftFilter(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	fan := harness.newUser("fan", "buyer")
	liveId := harness.goLive(host, nil)
	goals := "/api/v1/lives/" + liveId + "/gift-goals"
	harness.expect("POST", goals, &host, "", map[string]any{"title": "Mic", "targetCoins": 100, "giftId": "gift_nope"}, http.StatusNotFound)
	goal := harness.expect("POST", goals, &host, "", map[string]any{"title": "Mic", "targetCoins": 100, "giftId": "gift_heart"}, http.StatusCreated)
	goalPath := goals + "/" + goal["id"].(string)
	harness.expect("PATCH", goalPath, &host, "", map[string]any{"giftId": ""}, http.StatusBadRequest)
	harness.expect("PATCH", goalPath, &host, "", map[string]any{"giftId": "gift_nope"}, http.StatusNotFound)
	harness.expect("PATCH", goalPath, &fan, "", map[string]any{"giftId": "gift_rose"}, http.StatusForbidden)
	if edited := harness.expect("PATCH", goalPath, &host, "", map[string]any{"giftId": "gift_rose"}, http.StatusOK); edited["giftId"] != "gift_rose" {
		t.Fatalf("giftId must be applied: %v", edited)
	}
	if kept := harness.expect("PATCH", goalPath, &host, "", map[string]any{"title": "Better mic"}, http.StatusOK); kept["giftId"] != "gift_rose" || kept["title"] != "Better mic" {
		t.Fatalf("an absent giftId keeps the filter: %v", kept)
	}
	harness.expect("POST", "/api/v1/live/gifts", &fan, uuid.NewString(), map[string]any{"liveId": liveId, "giftId": "gift_heart", "quantity": 1}, http.StatusCreated)
	if progress := harness.expect("GET", goals, &fan, "", nil, http.StatusOK)["data"].([]any)[0].(map[string]any)["progressCoins"]; progress != float64(0) {
		t.Fatalf("other gifts must not count toward a filtered goal, got %v", progress)
	}
	if cleared := harness.expect("PATCH", goalPath, &host, "", map[string]any{"giftId": nil}, http.StatusOK); cleared["giftId"] != nil {
		t.Fatalf("null giftId must accept any gift: %v", cleared)
	}
	harness.expect("POST", "/api/v1/live/gifts", &fan, uuid.NewString(), map[string]any{"liveId": liveId, "giftId": "gift_heart", "quantity": 1}, http.StatusCreated)
	if progress := harness.expect("GET", goals, &fan, "", nil, http.StatusOK)["data"].([]any)[0].(map[string]any)["progressCoins"]; progress != float64(5) {
		t.Fatalf("any gift counts once the filter is cleared, got %v", progress)
	}
}

func TestBattlesCanBeReadAndStreamStatsListTheHostsBattles(t *testing.T) {
	scene := newBattleScene(t)
	harness := scene.harness
	battleId := scene.startRunningBattle(false, scene.host, scene.first)
	scene.gift(scene.host, "gift_rose", 2)
	scene.gift(scene.first, "gift_heart", 1)
	battle := harness.expect("GET", "/api/v1/battles/"+battleId, &scene.fan, "", nil, http.StatusOK)
	if battle["id"] != battleId || battle["liveId"] != scene.liveId || battle["state"] != "active" || len(battle["participants"].([]any)) != 2 {
		t.Fatalf("unexpected battle %v", battle)
	}
	harness.expect("GET", "/api/v1/battles/"+uuid.NewString(), &scene.fan, "", nil, http.StatusNotFound)
	harness.expect("GET", "/api/v1/battles/not-an-id", &scene.fan, "", nil, http.StatusBadRequest)
	harness.expect("GET", "/api/v1/battles/"+battleId, nil, "", nil, http.StatusUnauthorized)
	harness.relations.Block(scene.host.id, scene.fan.id)
	harness.expect("GET", "/api/v1/battles/"+battleId, &scene.fan, "", nil, http.StatusForbidden)
	harness.clock.Advance(61 * time.Second)
	scene.waitForBattleState("settled")
	stats := harness.expect("GET", "/api/v1/creators/me/analytics/gifts/streams/"+scene.liveId, &scene.host, "", nil, http.StatusOK)
	battles := stats["battles"].([]any)
	if len(battles) != 1 {
		t.Fatalf("expected one battle result, got %v", stats)
	}
	result := battles[0].(map[string]any)
	if result["id"] != battleId || result["opponentName"] != "first" || result["coinsFor"] != float64(20) || result["coinsAgainst"] != float64(5) {
		t.Fatalf("unexpected battle result %v", result)
	}
}
