package updatelivecoinsupport_test

import (
	"encoding/json"
	"testing"

	"nantty/modules/live/src/modules/sessions/commands/updateLiveCoinSupport"
)

func TestCoinSupportResponseMatchesLiveSessionContract(t *testing.T) {
	encoded, err := json.Marshal(updatelivecoinsupport.Result{LiveId: "live-1", GiftsEnabled: true})
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
