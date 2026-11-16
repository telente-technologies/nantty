package live_test

import (
	"net/http"
	"slices"
	"testing"
	"time"

	"github.com/livekit/protocol/auth"

	"nantty/modules/live/src/services"
)

func (harness *liveHarness) mediaGrant(liveId string, user liveUser) *auth.ClaimGrants {
	harness.t.Helper()
	issued := harness.expect("POST", "/api/v1/lives/"+liveId+"/media-token", &user, "", nil, http.StatusOK)
	verifier, err := auth.ParseAPIToken(issued["token"].(string))
	if err != nil {
		harness.t.Fatal(err)
	}
	_, claims, err := verifier.Verify(testSecret)
	if err != nil || claims.Video == nil {
		harness.t.Fatalf("livekit token invalid: %v", err)
	}
	return claims
}

func (harness *liveHarness) sendRoomEvent(event, room, identity string) {
	harness.t.Helper()
	payload := map[string]any{"event": event, "room": map[string]any{"name": room}}
	if identity != "" {
		payload["participant"] = map[string]any{"identity": identity}
	}
	if status := harness.sendLiveKitWebhook(payload, testSecret); status != http.StatusNoContent {
		harness.t.Fatalf("webhook %s answered %d", event, status)
	}
}

func TestMediaGrantsKeepViewersFromPublishing(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	viewer := harness.newUser("viewer", "buyer")
	otherHost := harness.newUser("other", "creator")
	liveId := harness.goLive(host, nil)
	otherLiveId := harness.goLive(otherHost, nil)

	hostGrant := harness.mediaGrant(liveId, host)
	viewerGrant := harness.mediaGrant(liveId, viewer)
	if !hostGrant.Video.GetCanPublish() || !slices.Contains(hostGrant.Video.CanPublishSources, "camera") || slices.Contains(hostGrant.Video.CanPublishSources, "unknown") {
		t.Fatalf("host must publish camera and mic only: %+v", hostGrant.Video)
	}
	if viewerGrant.Video.GetCanPublish() || viewerGrant.Video.GetCanPublishData() || len(viewerGrant.Video.CanPublishSources) != 0 || !viewerGrant.Video.GetCanSubscribe() {
		t.Fatalf("viewer must only subscribe: %+v", viewerGrant.Video)
	}
	if viewerGrant.Video.GetCanUpdateOwnMetadata() || viewerGrant.Video.RoomAdmin || viewerGrant.Video.RoomCreate {
		t.Fatalf("viewer must not manage rooms or rewrite its role: %+v", viewerGrant.Video)
	}
	if hostGrant.Video.Room != "live-"+liveId || viewerGrant.Video.Room != hostGrant.Video.Room || harness.mediaGrant(otherLiveId, viewer).Video.Room == hostGrant.Video.Room {
		t.Fatalf("each token must be bound to its own live's room: %s %s", hostGrant.Video.Room, viewerGrant.Video.Room)
	}
	if hostGrant.Metadata != `{"role":"host"}` || viewerGrant.Metadata != `{"role":"viewer"}` {
		t.Fatalf("unexpected role metadata host=%s viewer=%s", hostGrant.Metadata, viewerGrant.Metadata)
	}
	if harness.mediaGrant(otherLiveId, host).Video.GetCanPublish() {
		t.Fatal("a host must not get publish rights in someone else's live")
	}
	harness.expect("POST", "/api/v1/lives/"+liveId+"/end", &host, "", nil, http.StatusNoContent)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/media-token", &host, "", nil, http.StatusConflict)
}

func TestHostLeavingTheMediaRoomEndsTheLiveSoonerUnlessItStillHeartbeats(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	viewer := harness.newUser("viewer", "buyer")
	liveId := harness.goLive(host, nil)
	room := "live-" + liveId
	harness.expect("POST", "/api/v1/lives/"+liveId+"/heartbeat", &host, "", nil, http.StatusOK)

	harness.sendRoomEvent("participant_left", room, viewer.id.String())
	harness.sendRoomEvent("participant_left", "live-unknown-room", host.id.String())
	harness.clock.Advance(services.HostLeftMediaRoomGrace + time.Second)
	time.Sleep(300 * time.Millisecond)
	if harness.liveStatus(liveId, viewer) != "live" {
		t.Fatal("a viewer leaving, or an unknown room, must not end the live")
	}

	harness.sendRoomEvent("participant_left", room, host.id.String())
	harness.expect("POST", "/api/v1/lives/"+liveId+"/heartbeat", &host, "", nil, http.StatusOK)
	harness.clock.Advance(services.HostLeftMediaRoomGrace + time.Second)
	time.Sleep(300 * time.Millisecond)
	if harness.liveStatus(liveId, viewer) != "live" {
		t.Fatal("a host that still heartbeats after dropping out of the room must keep its live")
	}

	harness.sendRoomEvent("participant_left", room, host.id.String())
	harness.clock.Advance(services.HostLeftMediaRoomGrace + time.Second)
	waitUntil(t, func() bool { return harness.liveStatus(liveId, viewer) == "ended" })
	harness.waitForEvent("live.ended")
	harness.sendRoomEvent("room_finished", room, "")
}

func TestRoomFinishedEndsHeartbeatLivesButNotEncoderLives(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	encoderHost := harness.newUser("encoder", "creator")
	viewer := harness.newUser("viewer", "buyer")
	liveId := harness.goLive(host, nil)
	encoderLiveId := harness.goLive(encoderHost, nil)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/heartbeat", &host, "", nil, http.StatusOK)

	harness.sendRoomEvent("room_finished", "live-"+encoderLiveId, "")
	harness.sendRoomEvent("room_finished", "live-"+liveId, "")
	harness.clock.Advance(time.Second)
	waitUntil(t, func() bool { return harness.liveStatus(liveId, viewer) == "ended" })
	if harness.liveStatus(encoderLiveId, viewer) != "live" {
		t.Fatal("an encoder live has no heartbeat lease and must not be ended by a room event")
	}
}

func TestLiveKitWebhookRejectsForgedSignatures(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	viewer := harness.newUser("viewer", "buyer")
	liveId := harness.goLive(host, nil)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/heartbeat", &host, "", nil, http.StatusOK)
	forged := map[string]any{"event": "room_finished", "room": map[string]any{"name": "live-" + liveId}}
	if status := harness.sendLiveKitWebhook(forged, "not-the-livekit-secret-at-all-000000"); status != http.StatusUnauthorized {
		t.Fatalf("forged webhook answered %d", status)
	}
	harness.clock.Advance(time.Second)
	time.Sleep(300 * time.Millisecond)
	if harness.liveStatus(liveId, viewer) != "live" {
		t.Fatal("a forged room_finished must not end the live")
	}
}
