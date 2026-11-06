package updatelivecoinsupport

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"nantty/modules/live/src/generated/ent/livesession"
)

func TestHostMayChangeCoinSupport(t *testing.T) {
	host, anotherUser := uuid.New(), uuid.New()
	if !hostMayChangeCoinSupport(host.String(), host) {
		t.Fatal("authenticated host should be authorized")
	}
	if hostMayChangeCoinSupport(host.String(), anotherUser) {
		t.Fatal("non-host must not be authorized")
	}
}

func TestCoinSupportResponseMatchesLiveSessionContract(t *testing.T) {
	encoded, err := json.Marshal(Result{LiveId: "live-1", GiftsEnabled: true})
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	if err := json.Unmarshal(encoded, &payload); err != nil {
		t.Fatal(err)
	}
	if payload["liveId"] != "live-1" || payload["giftsEnabled"] != true {
		t.Fatalf("response = %s, want liveId and giftsEnabled", encoded)
	}
	if _, exists := payload["enabled"]; exists {
		t.Fatalf("response contains mismatched enabled key: %s", encoded)
	}
}

func TestCoinSupportStatePolicy(t *testing.T) {
	for _, test := range []struct {
		state       string
		isScheduled bool
	}{{string(livesession.StateIdle), true}, {string(livesession.StateConnecting), false}, {string(livesession.StateLive), false}} {
		if !liveStateAllowsCoinSupportChange(test.state, test.isScheduled) {
			t.Errorf("state %q scheduled=%v should permit changing coin support", test.state, test.isScheduled)
		}
	}
	for _, test := range []struct {
		state       string
		isScheduled bool
	}{{string(livesession.StateIdle), false}, {string(livesession.StateEnded), true}, {"unknown", true}} {
		if liveStateAllowsCoinSupportChange(test.state, test.isScheduled) {
			t.Errorf("state %q scheduled=%v should reject changing coin support", test.state, test.isScheduled)
		}
	}
}
