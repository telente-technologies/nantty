package live

import (
	"context"
	"net/http"
	"testing"
	"time"

	"nantty/modules/live/src/integrations"
)

func TestLiveKitRoomControllerToleratesMissingParticipantsOnTheLocalServer(t *testing.T) {
	response, err := http.Get("http://localhost:7880")
	if err != nil {
		t.Skipf("livekit not reachable (run pnpm backend:up): %v", err)
	}
	response.Body.Close()
	controller := integrations.NewLiveKitRoomController("http://localhost:7880", "devkey", testSecret)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	muted := true
	if err := controller.RemoveParticipant(ctx, "live-missing-room", "nobody"); err != nil {
		t.Fatalf("removing someone who already left must not fail: %v", err)
	}
	if err := controller.SetParticipantTracksMuted(ctx, "live-missing-room", "nobody", &muted, &muted); err != nil {
		t.Fatalf("muting someone who already left must not fail: %v", err)
	}
	if err := controller.EnsureRoom(ctx, "live-ensure-room"); err != nil {
		t.Fatalf("creating a room must work: %v", err)
	}
	if err := controller.EnsureRoom(ctx, "live-ensure-room"); err != nil {
		t.Fatalf("creating the same room again must be idempotent: %v", err)
	}
	if err := controller.DeleteRoom(ctx, "live-ensure-room"); err != nil {
		t.Fatalf("closing a room must work: %v", err)
	}
	if err := controller.DeleteRoom(ctx, "live-ensure-room"); err != nil {
		t.Fatalf("closing a room that is already gone must not fail: %v", err)
	}
}
