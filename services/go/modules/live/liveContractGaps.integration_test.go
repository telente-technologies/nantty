package live

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/interfaces"
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

func (harness *liveHarness) ownStore(owner liveUser, productIds ...uuid.UUID) string {
	storeId := uuid.New()
	harness.catalog.AddMember(storeId, owner.id)
	for _, productId := range productIds {
		image := "https://media.zudomart.test/" + productId.String() + ".jpg"
		harness.catalog.AddProduct(storeId, interfaces.StoreProduct{Id: productId, Title: "Product " + productId.String()[:4], PriceMinor: 125000, Currency: "NGN", ImageUrl: &image, Status: "active"})
	}
	return storeId.String()
}

func TestHostPinsAndUnpinsProductsAndViewersCannot(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	seller := harness.newUser("seller", "creator", "seller")
	viewer := harness.newUser("viewer", "buyer", "seller")
	firstId, secondId := uuid.New(), uuid.New()
	storeId := harness.ownStore(seller, firstId, secondId)
	liveId := harness.expect("POST", "/api/v1/lives", &seller, "", map[string]any{"title": "Flash sale", "category": "shopping", "storeId": storeId}, http.StatusCreated)["id"].(string)
	first, second := firstId.String(), secondId.String()
	harness.expect("POST", "/api/v1/lives/"+liveId+"/pins", &viewer, "", map[string]any{"productId": first}, http.StatusForbidden)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/pins", &seller, "", map[string]any{"productId": first}, http.StatusOK)
	pinned := harness.expect("POST", "/api/v1/lives/"+liveId+"/pins", &seller, "", map[string]any{"productId": second}, http.StatusOK)["data"].([]any)
	if len(pinned) != 2 || pinned[0].(map[string]any)["pinned"] != false || pinned[1].(map[string]any)["pinned"] != true {
		t.Fatalf("only the newest pin stays on screen: %v", pinned)
	}
	snapshot := pinned[1].(map[string]any)
	price, _ := snapshot["price"].(map[string]any)
	if snapshot["title"] != "Product "+second[:4] || price["amountMinor"] != float64(125000) || price["currency"] != "NGN" || snapshot["imageUrl"] == nil {
		t.Fatalf("the pin must carry the catalog snapshot: %v", snapshot)
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

func TestStoreLivesAndPinsOnlyUseTheHostsOwnStoreAndProducts(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	seller := harness.newUser("seller", "creator", "seller")
	rival := harness.newUser("rival", "creator", "seller")
	ownId, draftId, rivalProductId := uuid.New(), uuid.New(), uuid.New()
	storeId := harness.ownStore(seller, ownId)
	harness.catalog.AddProduct(uuid.MustParse(storeId), interfaces.StoreProduct{Id: draftId, Title: "Draft", PriceMinor: 100, Currency: "NGN", Status: "draft"})
	harness.ownStore(rival, rivalProductId)
	create := func(user liveUser, body map[string]any, status int) map[string]any {
		body["title"], body["category"] = "Sale", "shopping"
		return harness.expect("POST", "/api/v1/lives", &user, "", body, status)
	}
	if refused := create(rival, map[string]any{"storeId": storeId}, http.StatusForbidden); refused["code"] != "NOT_STORE_MEMBER" {
		t.Fatalf("a foreign store must be refused: %v", refused)
	}
	create(seller, map[string]any{"productIds": []string{ownId.String()}}, http.StatusUnprocessableEntity)
	if refused := create(seller, map[string]any{"storeId": storeId, "productIds": []string{ownId.String(), rivalProductId.String()}}, http.StatusForbidden); refused["code"] != "PRODUCT_NOT_IN_STORE" {
		t.Fatalf("a foreign product must be refused at create: %v", refused)
	}
	harness.catalog.SetUnavailable(true)
	if refused := create(seller, map[string]any{"storeId": storeId}, http.StatusServiceUnavailable); refused["code"] != "CATALOG_UNAVAILABLE" {
		t.Fatalf("an unreachable catalog must fail closed: %v", refused)
	}
	harness.catalog.SetUnavailable(false)
	live := create(seller, map[string]any{"storeId": storeId, "productIds": []string{ownId.String(), draftId.String()}}, http.StatusCreated)
	liveId := live["id"].(string)
	if live["storeId"] != storeId {
		t.Fatalf("the live view must name its store: %v", live["storeId"])
	}
	products := harness.expect("GET", "/api/v1/lives/"+liveId+"/products", &seller, "", nil, http.StatusOK)["data"].([]any)
	if len(products) != 2 || products[0].(map[string]any)["title"] == nil {
		t.Fatalf("own products are listed with their snapshot: %v", products)
	}
	pins := "/api/v1/lives/" + liveId + "/pins"
	if refused := harness.expect("POST", pins, &seller, "", map[string]any{"productId": rivalProductId.String()}, http.StatusForbidden); refused["code"] != "PRODUCT_NOT_IN_STORE" {
		t.Fatalf("a foreign product must not be pinned: %v", refused)
	}
	harness.expect("POST", pins, &seller, "", map[string]any{"productId": uuid.NewString()}, http.StatusForbidden)
	if refused := harness.expect("POST", pins, &seller, "", map[string]any{"productId": draftId.String()}, http.StatusUnprocessableEntity); refused["code"] != "PRODUCT_NOT_PUBLISHED" {
		t.Fatalf("a draft product must not be pinned: %v", refused)
	}
	harness.catalog.SetUnavailable(true)
	harness.expect("POST", pins, &seller, "", map[string]any{"productId": ownId.String()}, http.StatusServiceUnavailable)
	harness.catalog.SetUnavailable(false)
	harness.expect("POST", pins, &seller, "", map[string]any{"productId": ownId.String()}, http.StatusOK)
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
