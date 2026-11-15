package live_test

import (
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

func (harness *liveHarness) liveStatus(liveId string, user liveUser) string {
	return harness.expect("GET", "/api/v1/lives/"+liveId, &user, "", nil, http.StatusOK)["status"].(string)
}

func TestDoubleTapGoLiveStartsExactlyOneLive(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	const taps = 6
	statuses := make([]int, taps)
	bodies := make([]map[string]any, taps)
	var group sync.WaitGroup
	for index := range taps {
		group.Add(1)
		go func() {
			defer group.Done()
			statuses[index], bodies[index] = harness.call("POST", "/api/v1/lives", &host, "", map[string]any{"title": "Tap tap", "category": "gaming"})
		}()
	}
	group.Wait()
	var createdId string
	for index, status := range statuses {
		if status == http.StatusCreated {
			if createdId != "" {
				t.Fatalf("two lives were created: %s and %v", createdId, bodies[index]["id"])
			}
			createdId = bodies[index]["id"].(string)
		}
	}
	if createdId == "" {
		t.Fatalf("no live was created: %v", statuses)
	}
	for index, status := range statuses {
		if status == http.StatusCreated {
			continue
		}
		details, _ := bodies[index]["details"].(map[string]any)
		if status != http.StatusConflict || bodies[index]["code"] != "LIVE_ALREADY_RUNNING" || details["liveId"] != createdId {
			t.Fatalf("a repeated tap must point at the running live, got %d %v", status, bodies[index])
		}
	}
}

func TestEndingTwiceIsIdempotentAndEndsOnce(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	viewer := harness.newUser("viewer", "buyer")
	liveId := harness.goLive(host, nil)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/end", &viewer, "", nil, http.StatusForbidden)
	var group sync.WaitGroup
	for range 3 {
		group.Add(1)
		go func() {
			defer group.Done()
			if status, body := harness.call("POST", "/api/v1/lives/"+liveId+"/end", &host, "", nil); status != http.StatusNoContent {
				t.Errorf("ending again must succeed quietly, got %d %v", status, body)
			}
		}()
	}
	group.Wait()
	harness.waitForEvent("live.ended")
	time.Sleep(300 * time.Millisecond)
	ended := 0
	for _, published := range harness.publisher.PublishedEventTypes() {
		if published == "live.ended" {
			ended++
		}
	}
	if ended != 1 {
		t.Fatalf("live.ended must be published once, got %d", ended)
	}
	if harness.liveStatus(liveId, viewer) != "ended" {
		t.Fatal("live should be ended")
	}
	harness.goLive(host, nil)
}

func TestHostHeartbeatTimeoutEndsTheLive(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	viewer := harness.newUser("viewer", "buyer")
	liveId := harness.goLive(host, nil)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/heartbeat", &viewer, "", nil, http.StatusForbidden)
	beat := harness.expect("POST", "/api/v1/lives/"+liveId+"/heartbeat", &host, "", nil, http.StatusOK)
	if beat["status"] != "live" || beat["leaseExpiresAt"] == nil || beat["timeoutSeconds"] != float64(60) {
		t.Fatalf("unexpected heartbeat %v", beat)
	}
	harness.clock.Advance(59 * time.Second)
	time.Sleep(300 * time.Millisecond)
	if harness.liveStatus(liveId, viewer) != "live" {
		t.Fatal("the live must survive inside the heartbeat window")
	}
	harness.clock.Advance(2 * time.Second)
	waitUntil(t, func() bool { return harness.liveStatus(liveId, viewer) == "ended" })
	harness.waitForEvent("live.ended")
	if after := harness.expect("POST", "/api/v1/lives/"+liveId+"/heartbeat", &host, "", nil, http.StatusOK); after["status"] != "ended" || after["leaseExpiresAt"] != nil {
		t.Fatalf("a late heartbeat must learn the live ended, got %v", after)
	}
	harness.expect("POST", "/api/v1/lives/"+liveId+"/end", &host, "", nil, http.StatusNoContent)
}

func TestReconnectWithinGraceKeepsTheLive(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	viewer := harness.newUser("viewer", "buyer")
	liveId := harness.goLive(host, nil)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/heartbeat", &host, "", nil, http.StatusOK)
	for range 3 {
		harness.clock.Advance(45 * time.Second)
		harness.expect("POST", "/api/v1/lives/"+liveId+"/heartbeat", &host, "", nil, http.StatusOK)
	}
	time.Sleep(300 * time.Millisecond)
	if harness.liveStatus(liveId, viewer) != "live" {
		t.Fatal("heartbeats inside the grace window must keep the live running")
	}
}

func TestLiveWithoutHeartbeatsIsNeverAutoEnded(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	viewer := harness.newUser("viewer", "buyer")
	liveId := harness.goLive(host, nil)
	harness.clock.Advance(30 * time.Minute)
	time.Sleep(300 * time.Millisecond)
	if harness.liveStatus(liveId, viewer) != "live" {
		t.Fatal("encoder lives that never heartbeat must not be ended by the sweep")
	}
}

func TestGiftAfterTheLiveEndsIsRefusedWithoutCharging(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	fan := harness.newUser("fan", "buyer")
	liveId := harness.goLive(host, nil)
	harness.expect("POST", "/api/v1/live/gifts", &fan, uuid.NewString(), map[string]any{"liveId": liveId, "giftId": "gift_rose", "quantity": 1}, http.StatusCreated)
	charges := len(harness.money.Charges)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/end", &host, "", nil, http.StatusNoContent)
	refused := harness.expect("POST", "/api/v1/live/gifts", &fan, uuid.NewString(), map[string]any{"liveId": liveId, "giftId": "gift_rose", "quantity": 1}, http.StatusConflict)
	if refused["code"] != "LIVE_NOT_ACTIVE" || len(harness.money.Charges) != charges {
		t.Fatalf("a gift to an ended live must be refused before charging: %v", refused)
	}
}
