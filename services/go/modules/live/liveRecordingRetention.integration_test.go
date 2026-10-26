package live

import (
	"context"
	"net/http"
	"sync"
	"testing"
	"time"

	"nantty/modules/live/src/services"
)

type countingRecordingStorage struct {
	mutex   sync.Mutex
	deleted []string
}

func (storage *countingRecordingStorage) PresignDownload(_ context.Context, objectKey string, _ time.Duration) (string, error) {
	return "https://recordings.test/" + objectKey, nil
}

func (storage *countingRecordingStorage) DeleteObject(_ context.Context, objectKey string) error {
	storage.mutex.Lock()
	storage.deleted = append(storage.deleted, objectKey)
	storage.mutex.Unlock()
	return nil
}

func (storage *countingRecordingStorage) deletedCount() int {
	storage.mutex.Lock()
	defer storage.mutex.Unlock()
	return len(storage.deleted)
}

func (harness *liveHarness) recordAndEndLive(name string, succeeded bool) (liveUser, string) {
	harness.t.Helper()
	host := harness.newUser(name, "creator")
	liveId := harness.goLive(host, nil)
	base := "/api/v1/lives/" + liveId
	harness.expect("PUT", base+"/recording", &host, "", map[string]any{"enabled": true}, http.StatusOK)
	harness.expect("POST", base+"/end", &host, "", nil, http.StatusNoContent)
	egressId := harness.recorder.Stopped[len(harness.recorder.Stopped)-1]
	status := map[bool]string{true: "EGRESS_COMPLETE", false: "EGRESS_FAILED"}[succeeded]
	info := map[string]any{"egressId": egressId, "status": status, "error": "encoder crashed", "fileResults": []map[string]any{{"duration": "60000000000", "size": "2048"}}}
	if code := harness.sendLiveKitWebhook(map[string]any{"event": "egress_ended", "egressInfo": info}, testSecret); code != http.StatusNoContent {
		harness.t.Fatalf("egress webhook rejected: %d", code)
	}
	return host, liveId
}

func (harness *liveHarness) recordingsOf(host liveUser, liveId string) []map[string]any {
	harness.t.Helper()
	rows := harness.expect("GET", "/api/v1/lives/"+liveId+"/recordings", &host, "", nil, http.StatusOK)["data"].([]any)
	recordings := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		recordings = append(recordings, row.(map[string]any))
	}
	return recordings
}

func (harness *liveHarness) purgeExpiredRecordings() int {
	harness.t.Helper()
	purged, err := services.NewLiveService(harness.module.Container).PurgeUnrepostedLiveRecordingsPastRetention(context.Background())
	if err != nil {
		harness.t.Fatalf("retention sweep failed: %v", err)
	}
	return purged
}

func TestUnrepostedRecordingIsDeletedFifteenDaysAfterTheLiveEndsAndRerunsAreIdempotent(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	storage := &countingRecordingStorage{}
	harness.module.Container.RecordingStorage = storage
	host, liveId := harness.recordAndEndLive("host", true)
	_, failedLiveId := harness.recordAndEndLive("failing", false)
	recording := harness.recordingsOf(host, liveId)[0]
	if recording["repostedAt"] != nil || recording["deletesAt"] == nil {
		t.Fatalf("an unreposted recording shows when it will be deleted: %v", recording)
	}
	harness.clock.Advance(14*24*time.Hour + 23*time.Hour)
	if purged := harness.purgeExpiredRecordings(); purged != 0 || len(harness.recordingsOf(host, liveId)) != 1 {
		t.Fatalf("at 14 days 23 hours nothing is deleted, purged %d", purged)
	}
	harness.clock.Advance(time.Hour)
	if purged := harness.purgeExpiredRecordings(); purged != 2 || storage.deletedCount() != 2 {
		t.Fatalf("at 15 days the completed and the failed recording are deleted, purged %d deleted %v", purged, storage.deleted)
	}
	if len(harness.recordingsOf(host, liveId)) != 0 || storage.deleted[0] == "" {
		t.Fatalf("the recording row is gone after the sweep")
	}
	if purged := harness.purgeExpiredRecordings(); purged != 0 || storage.deletedCount() != 2 {
		t.Fatalf("a second sweep deletes nothing, purged %d", purged)
	}
	_ = failedLiveId
}

func TestRepostAtTheLastMinuteKeepsTheRecordingUntilThePostGoes(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	storage := &countingRecordingStorage{}
	harness.module.Container.RecordingStorage = storage
	host, liveId := harness.recordAndEndLive("host", true)
	viewer := harness.newUser("viewer", "buyer")
	recordingId := harness.recordingsOf(host, liveId)[0]["id"].(string)
	repostPath := "/api/v1/lives/" + liveId + "/recordings/" + recordingId + "/repost"
	harness.expect("POST", repostPath, &viewer, "", nil, http.StatusForbidden)
	harness.clock.Advance(15*24*time.Hour - time.Minute)
	reposted := harness.expect("POST", repostPath, &host, "", nil, http.StatusOK)
	if reposted["repostedAt"] == nil || reposted["deletesAt"] != nil {
		t.Fatalf("a reposted recording has no deletion date: %v", reposted)
	}
	harness.expect("POST", repostPath, &host, "", nil, http.StatusOK)
	harness.clock.Advance(30 * 24 * time.Hour)
	if purged := harness.purgeExpiredRecordings(); purged != 0 || len(harness.recordingsOf(host, liveId)) != 1 {
		t.Fatalf("a reposted recording is kept, purged %d", purged)
	}
	harness.expectInternal("PUT", "/api/v1/internal/live/recordings/"+recordingId+"/repost", map[string]any{"postId": ""}, http.StatusUnprocessableEntity)
	harness.expectInternal("PUT", "/api/v1/internal/live/recordings/"+recordingId+"/repost", map[string]any{"postId": nil}, http.StatusNoContent)
	if purged := harness.purgeExpiredRecordings(); purged != 1 || storage.deletedCount() != 1 {
		t.Fatalf("once the repost is removed past the window the recording is deleted, purged %d", purged)
	}
	harness.expect("POST", repostPath, &host, "", nil, http.StatusNotFound)
}

func TestLegalHoldBlocksRetentionAndManualDeletion(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	storage := &countingRecordingStorage{}
	harness.module.Container.RecordingStorage = storage
	host, liveId := harness.recordAndEndLive("host", true)
	recordingId := harness.recordingsOf(host, liveId)[0]["id"].(string)
	holdPath := "/api/v1/internal/live/" + liveId + "/recordings/legal-hold"
	harness.expectInternal("PUT", holdPath, map[string]any{}, http.StatusUnprocessableEntity)
	if held := harness.expectInternal("PUT", holdPath, map[string]any{"held": true}, http.StatusOK); held["recordings"] != float64(1) {
		t.Fatalf("the hold covers the live's recording: %v", held)
	}
	if harness.recordingsOf(host, liveId)[0]["deletesAt"] != nil {
		t.Fatalf("a held recording has no deletion date")
	}
	harness.clock.Advance(40 * 24 * time.Hour)
	if purged := harness.purgeExpiredRecordings(); purged != 0 || storage.deletedCount() != 0 {
		t.Fatalf("a held recording is never purged, purged %d", purged)
	}
	if code := harness.expect("DELETE", "/api/v1/lives/"+liveId+"/recordings/"+recordingId, &host, "", nil, http.StatusConflict)["code"]; code != "RECORDING_ON_HOLD" {
		t.Fatalf("the host cannot delete a held recording, got %v", code)
	}
	harness.expectInternal("PUT", holdPath, map[string]any{"held": false}, http.StatusOK)
	if purged := harness.purgeExpiredRecordings(); purged != 1 {
		t.Fatalf("after the hold is released the overdue recording is deleted, purged %d", purged)
	}
}

func (harness *liveHarness) expectInternal(method, path string, body any, wantStatus int) map[string]any {
	harness.t.Helper()
	status, decoded := harness.internalCall(method, path, testInternalToken, body)
	if status != wantStatus {
		harness.t.Fatalf("%s %s: want %d got %d %v", method, path, wantStatus, status, decoded)
	}
	return decoded
}
