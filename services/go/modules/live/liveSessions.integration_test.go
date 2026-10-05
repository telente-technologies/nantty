package live

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/livekit/protocol/auth"
)

func TestOnlyCreatorsGoLiveAndShoppingNeedsAStore(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	buyer := harness.newUser("buyer", "buyer")
	creator := harness.newUser("creator", "buyer", "creator")
	seller := harness.newUser("seller", "buyer", "creator", "seller")
	harness.expect("POST", "/api/v1/lives", &buyer, "", map[string]any{"title": "x", "category": "gaming"}, http.StatusForbidden)
	harness.expect("POST", "/api/v1/lives", nil, "", map[string]any{"title": "x", "category": "gaming"}, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/lives", &creator, "", map[string]any{"title": "x", "category": "shopping"}, http.StatusUnprocessableEntity)
	harness.expect("POST", "/api/v1/lives", &creator, "", map[string]any{"title": "", "category": "gaming"}, http.StatusBadRequest)
	harness.expect("POST", "/api/v1/lives", &creator, "", map[string]any{"title": "x", "category": "gaming", "surprise": 1}, http.StatusBadRequest)
	live := harness.expect("POST", "/api/v1/lives", &creator, "", map[string]any{"title": "Ranked grind", "category": "gaming"}, http.StatusCreated)
	if live["state"] != "live" || live["status"] != "live" || live["category"] != "gaming" || live["giftsEnabled"] != true {
		t.Fatalf("unexpected session %v", live)
	}
	harness.expect("POST", "/api/v1/lives", &creator, "", map[string]any{"title": "again", "category": "gaming"}, http.StatusConflict)
	harness.expect("POST", "/api/v1/lives/"+live["id"].(string)+"/pins", &creator, "", map[string]any{"productId": "6f1d3a52-0b0e-4c0e-9d57-1a2b3c4d5e6f"}, http.StatusUnprocessableEntity)
	storeId := harness.ownStore(seller, uuid.MustParse("6f1d3a52-0b0e-4c0e-9d57-1a2b3c4d5e6f"))
	shopping := harness.expect("POST", "/api/v1/lives", &seller, "", map[string]any{"title": "Shop", "category": "shopping", "storeId": storeId}, http.StatusCreated)["id"].(string)
	pinned := harness.expect("POST", "/api/v1/lives/"+shopping+"/pins", &seller, "", map[string]any{"productId": "6f1d3a52-0b0e-4c0e-9d57-1a2b3c4d5e6f"}, http.StatusOK)
	if len(pinned["data"].([]any)) != 1 {
		t.Fatalf("expected one pinned product, got %v", pinned)
	}
	fetched := harness.expect("GET", "/api/v1/lives/"+shopping, &buyer, "", nil, http.StatusOK)
	if fetched["pinnedProductId"] != "6f1d3a52-0b0e-4c0e-9d57-1a2b3c4d5e6f" {
		t.Fatalf("pinned product missing %v", fetched)
	}
}

func TestViewerCountMediaTokensAndEnding(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	viewer := harness.newUser("viewer", "buyer")
	liveId := harness.goLive(host, nil)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/join", &viewer, "", nil, http.StatusNoContent)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/join", &viewer, "", nil, http.StatusNoContent)
	if viewers := harness.expect("GET", "/api/v1/lives/"+liveId, &viewer, "", nil, http.StatusOK)["viewers"]; viewers != float64(1) {
		t.Fatalf("joining twice must count once, got %v", viewers)
	}
	hostToken := harness.expect("POST", "/api/v1/lives/"+liveId+"/media-token", &host, "", nil, http.StatusOK)
	viewerToken := harness.expect("POST", "/api/v1/lives/"+liveId+"/media-token", &viewer, "", nil, http.StatusOK)
	if hostToken["canPublish"] != true || viewerToken["canPublish"] != false || hostToken["role"] != "host" || viewerToken["role"] != "viewer" {
		t.Fatalf("unexpected grants host=%v viewer=%v", hostToken, viewerToken)
	}
	verifier, err := auth.ParseAPIToken(hostToken["token"].(string))
	if err != nil {
		t.Fatal(err)
	}
	_, claims, err := verifier.Verify(testSecret)
	if err != nil || claims.Video == nil || !claims.Video.RoomJoin || claims.Identity != host.id.String() {
		t.Fatalf("livekit token invalid: %v %+v", err, claims)
	}
	harness.expect("POST", "/api/v1/lives/"+liveId+"/end", &viewer, "", nil, http.StatusForbidden)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/end", &host, "", nil, http.StatusNoContent)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/end", &host, "", nil, http.StatusNoContent)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/join", &viewer, "", nil, http.StatusConflict)
	harness.waitForEvent("live.started")
	harness.waitForEvent("live.ended")
	harness.waitForEvent("live.viewerCountChanged")
}

func TestLiveAdSettingsStoreAcceptedTermsVersion(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	settings := map[string]any{"allowAds": true, "placements": []string{"beforeJoin"}, "maxInterruptions": 2, "minIntervalMinutes": 10, "showAdIndicator": true, "acceptedTermsVersion": nil, "acceptedAt": nil}
	harness.expect("POST", "/api/v1/lives", &host, "", map[string]any{"title": "x", "category": "music", "liveAdSettings": settings}, http.StatusUnprocessableEntity)
	harness.expect("POST", "/api/v1/lives", &host, "", map[string]any{"title": "x", "category": "music", "liveAdSettings": settings, "acceptedLiveAdTermsVersion": "1999-01"}, http.StatusUnprocessableEntity)
	settings["maxInterruptions"] = 9
	harness.expect("POST", "/api/v1/lives", &host, "", map[string]any{"title": "x", "category": "music", "liveAdSettings": settings, "acceptedLiveAdTermsVersion": "2026-10"}, http.StatusUnprocessableEntity)
	settings["maxInterruptions"] = 2
	created := harness.expect("POST", "/api/v1/lives", &host, "", map[string]any{
		"title": "x", "category": "music", "liveAdSettings": settings, "acceptedLiveAdTermsVersion": "2026-10", "sponsorshipLine": "Powered by Acme",
	}, http.StatusCreated)
	stored := created["liveAdSettings"].(map[string]any)
	if created["acceptedLiveAdTermsVersion"] != "2026-10" || stored["acceptedTermsVersion"] != "2026-10" || stored["acceptedAt"] == nil || created["sponsorshipLine"] != "Powered by Acme" {
		t.Fatalf("terms not stored: %v", created)
	}
}

func TestSuggestedLivesAndViewerSearchAnswerWithTheListEnvelope(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	liveId := harness.goLive(host, nil)
	for _, path := range []string{"/api/v1/lives/suggested", "/api/v1/lives/" + liveId + "/viewers"} {
		page := harness.expect("GET", path, &host, "", nil, http.StatusOK)
		if _, hasData := page["data"].([]any); !hasData {
			t.Fatalf("%s must answer {data, nextCursor}, got %v", path, page)
		}
		if cursor, hasCursor := page["nextCursor"]; !hasCursor || cursor != nil {
			t.Fatalf("%s must carry a null nextCursor, got %v", path, page)
		}
	}
}
