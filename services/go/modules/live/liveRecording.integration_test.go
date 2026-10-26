package live

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/livekit/protocol/auth"

	"nantty/modules/live/src/integrations"
)

func (harness *liveHarness) sendLiveKitWebhook(payload map[string]any, secret string) int {
	harness.t.Helper()
	body, _ := json.Marshal(payload)
	hash := sha256.Sum256(body)
	token, err := auth.NewAccessToken("devkey", secret).SetValidFor(time.Minute).SetSha256(base64.StdEncoding.EncodeToString(hash[:])).ToJWT()
	if err != nil {
		harness.t.Fatal(err)
	}
	request, _ := http.NewRequest("POST", harness.server.URL+"/api/v1/live/webhooks/livekit", bytes.NewReader(body))
	request.Header.Set("Authorization", token)
	request.Header.Set("Content-Type", "application/webhook+json")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		harness.t.Fatal(err)
	}
	defer response.Body.Close()
	return response.StatusCode
}

func TestRecordingIsOptionalStartsOnLiveAndReplayIsCreatorOnly(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	viewer := harness.newUser("viewer", "buyer")
	liveId := harness.goLive(host, nil)
	base := "/api/v1/lives/" + liveId
	if len(harness.recorder.Started) != 0 {
		t.Fatalf("recording is off by default")
	}
	harness.expect("PUT", base+"/recording", &viewer, "", map[string]any{"enabled": true}, http.StatusForbidden)
	harness.expect("PUT", base+"/recording", &host, "", map[string]any{}, http.StatusBadRequest)
	settings := harness.expect("PUT", base+"/recording", &host, "", map[string]any{"enabled": true}, http.StatusOK)
	if settings["recordEnabled"] != true || len(harness.recorder.Started) != 1 {
		t.Fatalf("enabling on a running live starts the egress: %v %v", settings, harness.recorder.Started)
	}
	harness.expect("PUT", base+"/recording", &host, "", map[string]any{"enabled": true}, http.StatusOK)
	if len(harness.recorder.Started) != 1 {
		t.Fatalf("enabling twice must not start a second egress")
	}
	harness.expect("GET", base+"/recordings", &viewer, "", nil, http.StatusForbidden)
	recordings := harness.expect("GET", base+"/recordings", &host, "", nil, http.StatusOK)["data"].([]any)
	if len(recordings) != 1 || recordings[0].(map[string]any)["state"] != "recording" || recordings[0].(map[string]any)["playbackUrl"] != nil {
		t.Fatalf("expected one in-progress recording %v", recordings)
	}
	harness.expect("POST", base+"/end", &host, "", nil, http.StatusNoContent)
	if len(harness.recorder.Stopped) != 1 {
		t.Fatalf("ending the live must stop the egress")
	}
	egressId := harness.recorder.Stopped[0]
	if status := harness.sendLiveKitWebhook(map[string]any{"event": "egress_ended", "egressInfo": map[string]any{"egressId": egressId, "status": "EGRESS_COMPLETE", "fileResults": []map[string]any{{"duration": "125000000000", "size": "4096"}}}}, "wrong-secret-wrong-secret-wrong-0001"); status != http.StatusUnauthorized {
		t.Fatalf("webhook with a bad signature must be rejected, got %d", status)
	}
	if status := harness.sendLiveKitWebhook(map[string]any{"event": "egress_ended", "egressInfo": map[string]any{"egressId": egressId, "status": "EGRESS_COMPLETE", "fileResults": []map[string]any{{"duration": "125000000000", "size": "4096"}}}}, testSecret); status != http.StatusNoContent {
		t.Fatalf("webhook rejected: %d", status)
	}
	done := harness.expect("GET", base+"/recordings", &host, "", nil, http.StatusOK)["data"].([]any)[0].(map[string]any)
	if done["state"] != "completed" || done["durationSeconds"] != float64(125) || done["sizeBytes"] != float64(4096) || done["playbackUrl"] == nil {
		t.Fatalf("completed recording expected %v", done)
	}
	harness.waitForEvent("liveRecording.completed")
}

func TestRecordingUnavailableWhenNotConfigured(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	liveId := harness.goLive(host, nil)
	harness.recorder.Failure = integrations.ErrRecordingUnavailable
	if code := harness.expect("PUT", "/api/v1/lives/"+liveId+"/recording", &host, "", map[string]any{"enabled": true}, http.StatusServiceUnavailable)["code"]; code != "RECORDING_UNAVAILABLE" {
		t.Fatalf("expected RECORDING_UNAVAILABLE got %v", code)
	}
}
