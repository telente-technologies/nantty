package live

import (
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/src/interfaces"
)

func TestStreamHealthIsHostOnlyAndReportsIngressState(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	other := harness.newUser("other", "creator")
	liveId := harness.goLive(host, nil)
	path := "/api/v1/lives/" + liveId + "/stream-health"
	harness.expect("GET", path, nil, "", nil, http.StatusUnauthorized)
	harness.expect("GET", path, &other, "", nil, http.StatusForbidden)
	harness.expect("GET", "/api/v1/lives/"+uuid.NewString()+"/stream-health", &host, "", nil, http.StatusNotFound)
	idle := harness.expect("GET", path, &host, "", nil, http.StatusOK)
	if idle["ingress"] != nil || idle["liveId"] != liveId || idle["checkedAt"] == nil {
		t.Fatalf("no ingress before a key is issued: %v", idle)
	}
	harness.expect("POST", "/api/v1/lives/"+liveId+"/stream-key?protocol=whip", &host, "", nil, http.StatusOK)
	inactive := harness.expect("GET", path, &host, "", nil, http.StatusOK)["ingress"].(map[string]any)
	if inactive["protocol"] != "whip" || inactive["status"] != "inactive" || inactive["videoBitrateKbps"] != nil {
		t.Fatalf("issued but silent ingress: %v", inactive)
	}
	harness.ingress.SetStatus("IN_1", interfaces.IngressStatus{Status: "publishing", VideoBitrateKbps: 4200, AudioBitrateKbps: 128, Width: 1280, Height: 720, Framerate: 30})
	publishing := harness.expect("GET", path, &host, "", nil, http.StatusOK)["ingress"].(map[string]any)
	if publishing["status"] != "publishing" || publishing["videoBitrateKbps"] != float64(4200) || publishing["height"] != float64(720) || publishing["framerate"] != float64(30) {
		t.Fatalf("publishing ingress stats: %v", publishing)
	}
	harness.ingress.Failure = errors.New("livekit unreachable")
	if unknown := harness.expect("GET", path, &host, "", nil, http.StatusOK)["ingress"].(map[string]any); unknown["status"] != "unknown" {
		t.Fatalf("a LiveKit failure degrades to unknown instead of erroring: %v", unknown)
	}
	harness.ingress.Failure = nil
}

func TestEndingWhileTheEncoderIsStillSendingRevokesTheIngress(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	liveId := harness.goLive(host, nil)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/stream-key", &host, "", nil, http.StatusOK)
	harness.ingress.SetStatus("IN_1", interfaces.IngressStatus{Status: "publishing", VideoBitrateKbps: 3000})
	harness.expect("POST", "/api/v1/lives/"+liveId+"/end", &host, "", nil, http.StatusNoContent)
	if len(harness.ingress.Deleted) != 1 || harness.ingress.Deleted[0] != "IN_1" {
		t.Fatalf("ending must delete the publishing ingress so OBS is cut off: %v", harness.ingress.Deleted)
	}
	health := harness.expect("GET", "/api/v1/lives/"+liveId+"/stream-health", &host, "", nil, http.StatusOK)
	if health["state"] != "ended" || health["ingress"] != nil {
		t.Fatalf("an ended live has no active ingress: %v", health)
	}
	harness.expect("POST", "/api/v1/lives/"+liveId+"/stream-key", &host, "", nil, http.StatusConflict)
}

func TestHostDefaultsValidateAndApplyToNewLives(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	moderator := harness.newUser("moderator", "buyer")
	viewer := harness.newUser("viewer", "buyer")
	path := "/api/v1/live/host-defaults"
	harness.expect("GET", path, nil, "", nil, http.StatusUnauthorized)
	fresh := harness.expect("GET", path, &host, "", nil, http.StatusOK)
	if fresh["commentsEnabled"] != true || fresh["commentAudience"] != "everyone" || len(fresh["moderators"].([]any)) != 0 {
		t.Fatalf("defaults before saving: %v", fresh)
	}
	if code := harness.expect("PUT", path, &host, "", map[string]any{"moderatorIds": []string{host.id.String()}}, http.StatusUnprocessableEntity)["code"]; code != "MODERATOR_SELF" {
		t.Fatalf("self moderator: %v", code)
	}
	if code := harness.expect("PUT", path, &host, "", map[string]any{"moderatorIds": []string{uuid.NewString()}}, http.StatusUnprocessableEntity)["code"]; code != "USER_NOT_FOUND" {
		t.Fatalf("unknown moderator: %v", code)
	}
	tooMany := make([]string, 21)
	for index := range tooMany {
		tooMany[index] = uuid.NewString()
	}
	if code := harness.expect("PUT", path, &host, "", map[string]any{"moderatorIds": tooMany}, http.StatusUnprocessableEntity)["code"]; code != "MODERATOR_LIMIT" {
		t.Fatalf("moderator limit: %v", code)
	}
	harness.expect("PUT", path, &host, "", map[string]any{"moderatorIds": []string{"not-a-uuid"}}, http.StatusBadRequest)
	harness.expect("PUT", path, &host, "", map[string]any{"commentAudience": "friends"}, http.StatusBadRequest)
	harness.expect("PUT", path, &host, "", map[string]any{"slowModeSeconds": 301}, http.StatusBadRequest)
	if code := harness.expect("PUT", path, &host, "", map[string]any{"blockedWords": []string{"a"}}, http.StatusUnprocessableEntity)["code"]; code != "BLOCKED_WORD_INVALID" {
		t.Fatalf("one-letter words stay invalid: %v", code)
	}
	saved := harness.expect("PUT", path, &host, "", map[string]any{
		"commentAudience": "followers", "slowModeSeconds": 5, "blockedWords": []string{"Scam", "🍑"}, "moderatorIds": []string{moderator.id.String(), moderator.id.String()},
	}, http.StatusOK)
	moderators := saved["moderators"].([]any)
	if saved["commentAudience"] != "followers" || len(moderators) != 1 || moderators[0].(map[string]any)["id"] != moderator.id.String() || saved["updatedAt"] == nil {
		t.Fatalf("saved defaults: %v", saved)
	}
	if again := harness.expect("GET", path, &host, "", nil, http.StatusOK); len(again["blockedWords"].([]any)) != 2 {
		t.Fatalf("defaults persist: %v", again)
	}
	if other := harness.expect("GET", path, &viewer, "", nil, http.StatusOK); other["commentAudience"] != "everyone" {
		t.Fatalf("defaults are per host: %v", other)
	}

	liveId := harness.goLive(host, nil)
	room := harness.expect("GET", "/api/v1/lives/"+liveId+"/room-settings", &host, "", nil, http.StatusOK)
	if room["commentAudience"] != "followers" || room["slowModeSeconds"] != float64(5) || len(room["blockedWords"].([]any)) != 2 {
		t.Fatalf("a new live copies the defaults: %v", room)
	}
	if listed := harness.expect("GET", "/api/v1/lives/"+liveId+"/moderators", &host, "", nil, http.StatusOK)["data"].([]any); len(listed) != 1 {
		t.Fatalf("default moderators are granted on the new live: %v", listed)
	}
}

func TestCommentAudienceIsEnforcedWithHostAndModeratorsExempt(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	follower := harness.newUser("follower", "buyer")
	stranger := harness.newUser("stranger", "buyer")
	subscriber := harness.newUser("subscriber", "buyer")
	moderator := harness.newUser("moderator", "buyer")
	harness.relations.Follow(follower.id, host.id)
	harness.relations.Subscribe(subscriber.id, host.id)
	liveId := harness.goLive(host, nil)
	settingsPath := "/api/v1/lives/" + liveId + "/room-settings"
	harness.expect("PUT", "/api/v1/lives/"+liveId+"/moderators/"+moderator.id.String(), &host, "", nil, http.StatusNoContent)
	harness.expect("PUT", settingsPath, &host, "", map[string]any{"commentAudience": "everyone-ish"}, http.StatusBadRequest)
	harness.expect("PUT", settingsPath, &follower, "", map[string]any{"commentAudience": "everyone"}, http.StatusForbidden)

	harness.expect("PUT", settingsPath, &host, "", map[string]any{"commentAudience": "followers"}, http.StatusOK)
	if code := harness.comment(liveId, stranger, "hello", http.StatusForbidden)["code"]; code != "COMMENTS_FOLLOWERS_ONLY" {
		t.Fatalf("stranger on a followers-only live: %v", code)
	}
	harness.comment(liveId, follower, "hello from a follower", http.StatusCreated)
	harness.comment(liveId, host, "host always can", http.StatusCreated)
	harness.comment(liveId, moderator, "moderators too", http.StatusCreated)

	harness.clock.Advance(2 * time.Second)
	harness.expect("PUT", settingsPath, &host, "", map[string]any{"commentAudience": "subscribers"}, http.StatusOK)
	if code := harness.comment(liveId, follower, "still here", http.StatusForbidden)["code"]; code != "COMMENTS_SUBSCRIBERS_ONLY" {
		t.Fatalf("follower on a subscribers-only live: %v", code)
	}
	harness.comment(liveId, subscriber, "subscriber hello", http.StatusCreated)
	harness.comment(liveId, moderator, "moderator still exempt", http.StatusCreated)
	if room := harness.expect("GET", settingsPath, &stranger, "", nil, http.StatusOK); room["commentAudience"] != "subscribers" {
		t.Fatalf("viewers can see who may comment: %v", room)
	}
}

func TestBlockedWordsCatchFullwidthCaseAndEmojiVariants(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	viewer := harness.newUser("viewer", "buyer")
	liveId := harness.goLive(host, nil)
	settingsPath := "/api/v1/lives/" + liveId + "/room-settings"
	harness.expect("PUT", settingsPath, &host, "", map[string]any{"blockedWords": []string{"x"}}, http.StatusUnprocessableEntity)
	settings := harness.expect("PUT", settingsPath, &host, "", map[string]any{"blockedWords": []string{"SCAM", "🍑", "❤️‍🔥"}}, http.StatusOK)
	if words := settings["blockedWords"].([]any); len(words) != 3 || words[0] != "scam" {
		t.Fatalf("words are lower-cased and a single emoji is allowed: %v", words)
	}
	for _, text := range []string{"ｓｃａｍ alert", "ScAm", "S C A M? no, sc@m", "nice 🍑", "🍑🍑🍑", "love it ❤️‍🔥", "ＳＣＡＭ"} {
		harness.clock.Advance(2 * time.Second)
		if code := harness.comment(liveId, viewer, text, http.StatusUnprocessableEntity)["code"]; code != "COMMENT_NOT_ALLOWED" {
			t.Fatalf("%q must be blocked, got %v", text, code)
		}
	}
	for _, text := range []string{"scampi for dinner", "a peach emoji is fine as words", "❤️ without fire"} {
		harness.clock.Advance(2 * time.Second)
		harness.comment(liveId, viewer, text, http.StatusCreated)
	}
}

func TestRecordingDeleteIsHostOnlyAndRefusesInProgress(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	other := harness.newUser("other", "creator")
	liveId := harness.goLive(host, nil)
	base := "/api/v1/lives/" + liveId
	harness.expect("PUT", base+"/recording", &host, "", map[string]any{"enabled": true}, http.StatusOK)
	recordingId := harness.expect("GET", base+"/recordings", &host, "", nil, http.StatusOK)["data"].([]any)[0].(map[string]any)["id"].(string)
	harness.expect("DELETE", base+"/recordings/"+recordingId, &other, "", nil, http.StatusForbidden)
	if code := harness.expect("DELETE", base+"/recordings/"+recordingId, &host, "", nil, http.StatusConflict)["code"]; code != "RECORDING_IN_PROGRESS" {
		t.Fatalf("in-progress recording: %v", code)
	}
	harness.expect("POST", base+"/end", &host, "", nil, http.StatusNoContent)
	egressId := harness.recorder.Stopped[0]
	webhook := map[string]any{"event": "egress_ended", "egressInfo": map[string]any{"egressId": egressId, "status": "EGRESS_COMPLETE", "fileResults": []map[string]any{{"duration": "60000000000", "size": "2048"}}}}
	if status := harness.sendLiveKitWebhook(webhook, testSecret); status != http.StatusNoContent {
		t.Fatalf("webhook rejected: %d", status)
	}
	otherLive := harness.goLive(other, nil)
	harness.expect("DELETE", "/api/v1/lives/"+otherLive+"/recordings/"+recordingId, &other, "", nil, http.StatusNotFound)
	harness.expect("DELETE", base+"/recordings/not-a-uuid", &host, "", nil, http.StatusBadRequest)
	harness.expect("DELETE", base+"/recordings/"+recordingId, &host, "", nil, http.StatusNoContent)
	if code := harness.expect("DELETE", base+"/recordings/"+recordingId, &host, "", nil, http.StatusNotFound)["code"]; code != "RECORDING_NOT_FOUND" {
		t.Fatalf("second delete: %v", code)
	}
	if left := harness.expect("GET", base+"/recordings", &host, "", nil, http.StatusOK)["data"].([]any); len(left) != 0 {
		t.Fatalf("deleted recording still listed: %v", left)
	}
}
