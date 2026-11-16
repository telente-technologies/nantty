package live_test

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

func (harness *liveHarness) stage(liveId string, user liveUser) map[string]any {
	harness.t.Helper()
	return harness.expect("GET", "/api/v1/lives/"+liveId+"/stage", &user, "", nil, http.StatusOK)
}

func (harness *liveHarness) putOnStage(liveId string, host, guest liveUser) {
	harness.t.Helper()
	invited := harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/invitations", &host, "", map[string]any{"userId": guest.id.String()}, http.StatusOK)
	_ = invited
	slot := harness.stage(liveId, guest)["invitationForMe"].(map[string]any)
	accepted := harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/invitations/"+slot["id"].(string)+"/accept", &guest, "", nil, http.StatusOK)
	if accepted["livekit"] == nil || accepted["myRole"] != "guest" {
		harness.t.Fatalf("accept returns the stage plus media credentials: %v", accepted)
	}
}

func TestGuestInvitationsFillTenSeatsAndHostControlsMedia(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	liveId := harness.goLive(host, nil)
	guests := make([]liveUser, 0, 10)
	for index := 0; index < 10; index++ {
		guests = append(guests, harness.newUser(fmt.Sprintf("guest%d", index), "buyer"))
	}
	for _, guest := range guests[:9] {
		harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/invitations", &host, "", map[string]any{"userId": guest.id.String()}, http.StatusOK)
	}
	full := harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/invitations", &host, "", map[string]any{"userId": guests[9].id.String()}, http.StatusConflict)
	if full["code"] != "STAGE_FULL" {
		t.Fatalf("expected STAGE_FULL got %v", full)
	}
	harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/invitations", &guests[0], "", map[string]any{"userId": guests[9].id.String()}, http.StatusForbidden)
	for _, guest := range guests[:9] {
		slot := harness.stage(liveId, guest)["invitationForMe"].(map[string]any)
		harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/invitations/"+slot["id"].(string)+"/accept", &guest, "", nil, http.StatusOK)
	}
	stage := harness.stage(liveId, host)
	if len(stage["streamers"].([]any)) != 10 || stage["phase"] != "onStage" || stage["layout"] != "grid" || stage["myRole"] != "host" {
		t.Fatalf("unexpected full stage %v", stage)
	}
	harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/requests", &guests[9], "", nil, http.StatusConflict)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/"+guests[0].id.String()+"/mute", &host, "", map[string]any{"audio": true, "video": true}, http.StatusOK)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/me/mute", &guests[0], "", map[string]any{"audio": false}, http.StatusForbidden)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/"+guests[1].id.String()+"/mute", &guests[0], "", map[string]any{"audio": true}, http.StatusForbidden)
	muted := findStreamer(harness.stage(liveId, guests[0]), guests[0].id.String())
	if muted["audioMuted"] != true || muted["videoMuted"] != true {
		t.Fatalf("host mute not applied: %v", muted)
	}
	harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/me/mute", &guests[1], "", map[string]any{"audio": true}, http.StatusOK)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/"+guests[2].id.String()+"/remove", &host, "", map[string]any{"reason": "mic noise"}, http.StatusOK)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/me/leave", &guests[3], "", nil, http.StatusOK)
	if len(harness.stage(liveId, host)["streamers"].([]any)) != 8 {
		t.Fatal("removed and left guests free their seats")
	}
	harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/me/leave", &host, "", nil, http.StatusUnprocessableEntity)
	harness.waitForEvent("guest.invited")
	harness.waitForEvent("guest.joined")
	harness.waitForEvent("guest.muted")
	harness.waitForEvent("guest.removed")
	harness.waitForEvent("guest.left")
	harness.waitForEvent("stage.updated")
}

func findStreamer(stage map[string]any, userId string) map[string]any {
	for _, entry := range stage["streamers"].([]any) {
		streamer := entry.(map[string]any)
		if streamer["user"].(map[string]any)["id"] == userId {
			return streamer
		}
	}
	return nil
}

func TestInvitationsExpireDeclineAndJoinRequests(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	late := harness.newUser("late", "buyer")
	decliner := harness.newUser("decliner", "buyer")
	requester := harness.newUser("requester", "buyer")
	liveId := harness.goLive(host, nil)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/invitations", &host, "", map[string]any{"userId": late.id.String()}, http.StatusOK)
	lateSlot := harness.stage(liveId, late)["invitationForMe"].(map[string]any)["id"].(string)
	harness.clock.Advance(61 * time.Second)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/invitations/"+lateSlot+"/accept", &late, "", nil, http.StatusGone)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/invitations", &host, "", map[string]any{"userId": decliner.id.String()}, http.StatusOK)
	slot := harness.stage(liveId, decliner)["invitationForMe"].(map[string]any)["id"].(string)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/invitations/"+slot+"/decline", &decliner, "", nil, http.StatusOK)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/invitations/"+slot+"/accept", &decliner, "", nil, http.StatusGone)
	requested := harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/requests", &requester, "", nil, http.StatusOK)
	if requested["myJoinRequest"] == nil {
		t.Fatalf("viewer should see their pending request: %v", requested)
	}
	pending := harness.stage(liveId, host)["joinRequests"].([]any)
	if len(pending) != 1 {
		t.Fatalf("host should see one request, got %v", pending)
	}
	approved := harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/requests/"+pending[0].(map[string]any)["id"].(string)+"/approve", &host, "", nil, http.StatusOK)
	if len(approved["streamers"].([]any)) != 2 {
		t.Fatalf("approved request joins the stage: %v", approved)
	}
}

func TestReconnectingGuestLeavesAfterGracePeriod(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	guest := harness.newUser("guest", "buyer")
	liveId := harness.goLive(host, nil)
	harness.putOnStage(liveId, host, guest)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/me/connection", &guest, "", map[string]any{"connected": false}, http.StatusOK)
	if findStreamer(harness.stage(liveId, host), guest.id.String())["state"] != "reconnecting" {
		t.Fatal("a dropped guest is reconnecting")
	}
	harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/me/connection", &guest, "", map[string]any{"connected": true}, http.StatusOK)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/guests/me/connection", &guest, "", map[string]any{"connected": false}, http.StatusOK)
	harness.clock.Advance(31 * time.Second)
	waitUntil(t, func() bool { return findStreamer(harness.stage(liveId, host), guest.id.String()) == nil })
	harness.waitForEvent("guest.reconnecting")
}

func waitUntil(t *testing.T, condition func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if condition() {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatal("condition not met in time")
}
