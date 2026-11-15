package live_test

import (
	"net/http"
	"testing"
)

func TestGiftCatalogIsDataDrivenWithEtagAndAdminCrud(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	viewer := harness.newUser("viewer", "buyer")
	admin := harness.newUser("admin", "admin")
	catalog := harness.expect("GET", "/api/v1/gifts", &viewer, "", nil, http.StatusOK)
	if len(catalog["data"].([]any)) != 26 || catalog["nextCursor"] != nil {
		t.Fatalf("expected 26 seeded gifts, got %v", len(catalog["data"].([]any)))
	}
	first := catalog["data"].([]any)[0].(map[string]any)
	for _, field := range []string{"id", "name", "tier", "priceCoins", "animationEngine", "animationAssetKey", "previewAssetKey", "durationMs", "displayLevel", "comboable", "isActive", "sortOrder"} {
		if _, present := first[field]; !present {
			t.Fatalf("catalog entry misses %s: %v", field, first)
		}
	}
	harness.expect("POST", "/api/v1/admin/gifts", &viewer, "", map[string]any{"id": "gift_x"}, http.StatusForbidden)
	created := harness.expect("POST", "/api/v1/admin/gifts", &admin, "", map[string]any{
		"id": "gift_comet", "name": "Comet", "tier": "premium", "priceCoins": 777, "animationAssetKey": "comet-v1", "previewAssetKey": "comet-v1", "durationMs": 3000, "displayLevel": "large",
	}, http.StatusCreated)
	if created["isActive"] != true || created["animationEngine"] != "lottie" {
		t.Fatalf("unexpected defaults %v", created)
	}
	harness.expect("POST", "/api/v1/admin/gifts", &admin, "", map[string]any{"id": "gift_comet", "name": "Comet", "tier": "premium", "priceCoins": 1, "animationAssetKey": "a", "previewAssetKey": "a", "durationMs": 1, "displayLevel": "large"}, http.StatusConflict)
	after := harness.expect("GET", "/api/v1/gifts", &viewer, "", nil, http.StatusOK)["data"].([]any)
	if len(after) != 27 {
		t.Fatalf("new gift should appear without release, got %d", len(after))
	}
	harness.expect("PATCH", "/api/v1/admin/gifts/gift_comet", &admin, "", map[string]any{"priceCoins": 800}, http.StatusOK)
	harness.expect("DELETE", "/api/v1/admin/gifts/gift_comet", &admin, "", nil, http.StatusNoContent)
	if len(harness.expect("GET", "/api/v1/gifts", &viewer, "", nil, http.StatusOK)["data"].([]any)) != 26 {
		t.Fatal("retired gift must leave the catalogue")
	}
	if len(harness.expect("GET", "/api/v1/admin/gifts", &admin, "", nil, http.StatusOK)["data"].([]any)) != 27 {
		t.Fatal("admin list keeps retired gifts")
	}
	request, _ := http.NewRequest("GET", harness.server.URL+"/api/v1/gifts", nil)
	request.Header.Set("Authorization", "Bearer "+viewer.token)
	response, _ := http.DefaultClient.Do(request)
	etag := response.Header.Get("ETag")
	response.Body.Close()
	request.Header.Set("If-None-Match", etag)
	cached, _ := http.DefaultClient.Do(request)
	cached.Body.Close()
	if etag == "" || cached.StatusCode != http.StatusNotModified {
		t.Fatalf("etag %q revalidation %d", etag, cached.StatusCode)
	}
}

func TestSendGiftValidationIdempotencyCombosGoalsAndStats(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	fan := harness.newUser("fan", "buyer")
	poor := harness.newUser("poor", "buyer")
	harness.money.Balances[poor.id.String()] = 3
	liveId := harness.goLive(host, nil)
	send := func(user liveUser, key string, body map[string]any, status int) map[string]any {
		body["liveId"] = liveId
		return harness.expect("POST", "/api/v1/live/gifts", &user, key, body, status)
	}
	send(fan, "", map[string]any{"giftId": "gift_rose", "quantity": 1}, http.StatusBadRequest)
	send(fan, "short", map[string]any{"giftId": "gift_rose", "quantity": 1}, http.StatusBadRequest)
	send(fan, "key-quantity-0", map[string]any{"giftId": "gift_rose", "quantity": 0}, http.StatusBadRequest)
	send(fan, "key-quantity-101", map[string]any{"giftId": "gift_rose", "quantity": 101}, http.StatusBadRequest)
	send(fan, "key-unknown-gift", map[string]any{"giftId": "gift_nope", "quantity": 1}, http.StatusNotFound)
	send(host, "key-self-gift", map[string]any{"giftId": "gift_rose", "quantity": 1}, http.StatusUnprocessableEntity)
	send(fan, "key-not-on-stage", map[string]any{"giftId": "gift_rose", "quantity": 1, "receiverUserId": poor.id.String()}, http.StatusUnprocessableEntity)
	broke := send(poor, "key-insufficient", map[string]any{"giftId": "gift_rose", "quantity": 1}, http.StatusPaymentRequired)
	if broke["code"] != "INSUFFICIENT_COINS" || broke["issues"].([]any)[0].(map[string]any)["message"] != "3" {
		t.Fatalf("unexpected 402 %v", broke)
	}
	goal := harness.expect("POST", "/api/v1/lives/"+liveId+"/gift-goals", &host, "", map[string]any{"title": "New mic", "targetCoins": 25}, http.StatusCreated)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/gift-goals", &host, "", map[string]any{"title": "Another", "targetCoins": 50}, http.StatusConflict)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/gift-goals", &fan, "", map[string]any{"title": "Nope", "targetCoins": 50}, http.StatusForbidden)
	first := send(fan, "key-first-tap", map[string]any{"giftId": "gift_rose", "quantity": 1, "comboId": "cmb_one"}, http.StatusCreated)
	replay := send(fan, "key-first-tap", map[string]any{"giftId": "gift_rose", "quantity": 1, "comboId": "cmb_one"}, http.StatusCreated)
	if first["giftTransactionId"] != replay["giftTransactionId"] || first["coinBalance"] != replay["coinBalance"] || len(harness.money.Charges) != 1 {
		t.Fatalf("replay must return the same receipt and charge once: %v %v charges=%d", first, replay, len(harness.money.Charges))
	}
	second := send(fan, "key-second-tap", map[string]any{"giftId": "gift_rose", "quantity": 5, "comboId": "cmb_one"}, http.StatusCreated)
	if second["comboCount"] != float64(6) || second["totalCoins"] != float64(50) || second["receiverUserId"] != host.id.String() || second["battleId"] != nil {
		t.Fatalf("unexpected combo %v", second)
	}
	other := send(fan, "key-other-gift", map[string]any{"giftId": "gift_heart", "quantity": 1, "comboId": "cmb_one"}, http.StatusCreated)
	if other["comboCount"] != float64(1) {
		t.Fatalf("a different gift restarts the combo: %v", other)
	}
	goals := harness.expect("GET", "/api/v1/lives/"+liveId+"/gift-goals", &fan, "", nil, http.StatusOK)["data"].([]any)
	progress := goals[0].(map[string]any)
	if progress["id"] != goal["id"] || progress["status"] != "completed" || progress["progressCoins"] != float64(60) || progress["completedAt"] == nil {
		t.Fatalf("goal should complete once: %v", progress)
	}
	harness.waitForEvent("gift.sent")
	harness.waitForEvent("goal.completed")
	if completed := countPublished(harness, "goal.completed"); completed != 1 {
		t.Fatalf("goal.completed must publish exactly once, got %d", completed)
	}
	stats := harness.expect("GET", "/api/v1/creators/me/analytics/gifts/streams/"+liveId, &host, "", nil, http.StatusOK)
	if stats["giftCount"] != float64(7) || stats["totalCoins"] != float64(65) || stats["creatorCoins"] != float64(45) || stats["estimatedEarnings"] != nil {
		t.Fatalf("unexpected stats %v", stats)
	}
	harness.expect("GET", "/api/v1/creators/me/analytics/gifts/streams/"+liveId, &fan, "", nil, http.StatusForbidden)
	board := harness.expect("GET", "/api/v1/lives/"+liveId+"/leaderboard", &fan, "", nil, http.StatusOK)
	top := board["data"].([]any)[0].(map[string]any)
	if top["rank"] != float64(1) || top["coins"] != float64(65) || top["points"] != float64(65) || board["viewerRank"] != float64(1) {
		t.Fatalf("unexpected leaderboard %v", board)
	}
}

func countPublished(harness *liveHarness, eventType string) int {
	count := 0
	for _, published := range harness.publisher.PublishedEventTypes() {
		if published == eventType {
			count++
		}
	}
	return count
}
