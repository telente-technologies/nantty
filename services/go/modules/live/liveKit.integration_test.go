package live

import (
	"context"
	"net/http"
	"testing"
	"time"

	"zudomart/modules/live/src/integrations"
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
}
