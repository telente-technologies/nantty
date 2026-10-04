package services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
	"time"

	"zudomart/modules/live/src/configs"
	"zudomart/modules/live/src/events"
	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/interfaces"
	platformevents "zudomart/platform/events"
)

func FrameIntervalForLive(settings configs.LiveSafetySettings, state *ent.LiveSafetyState, now time.Time) (time.Duration, bool) {
	if state != nil && state.SamplingBoostUntil != nil && state.SamplingBoostUntil.After(now) {
		return settings.BoostedFrameInterval, true
	}
	return settings.FrameInterval, false
}

func IsFrameSampleDue(lastEnqueuedAt *time.Time, now time.Time, interval time.Duration) bool {
	return lastEnqueuedAt == nil || now.Sub(*lastEnqueuedAt) >= interval
}

func NewestSafetyObject(objects []interfaces.StoredSafetyObject, suffixes ...string) (interfaces.StoredSafetyObject, bool) {
	var newest interfaces.StoredSafetyObject
	found := false
	for _, object := range objects {
		if !hasAnySuffix(object.Key, suffixes) {
			continue
		}
		if !found || object.LastModified.After(newest.LastModified) || (object.LastModified.Equal(newest.LastModified) && object.Key > newest.Key) {
			newest, found = object, true
		}
	}
	return newest, found
}

func LastKey(objects []interfaces.StoredSafetyObject) string {
	last := ""
	for _, object := range objects {
		if object.Key > last {
			last = object.Key
		}
	}
	return last
}

func AudioSegmentsToTranscribe(objects []interfaces.StoredSafetyObject) []interfaces.StoredSafetyObject {
	var segments []interfaces.StoredSafetyObject
	for _, object := range objects {
		if hasAnySuffix(object.Key, []string{".ts", ".m4a", ".aac"}) {
			segments = append(segments, object)
		}
	}
	return segments
}

func hasAnySuffix(key string, suffixes []string) bool {
	if len(suffixes) == 0 {
		return true
	}
	for _, suffix := range suffixes {
		if strings.HasSuffix(strings.ToLower(key), suffix) {
			return true
		}
	}
	return false
}

func FramePrefixForLive(settings configs.LiveSafetySettings, liveId string) string {
	return settings.FramesPrefix + liveId + "/"
}

func AudioPrefixForLive(settings configs.LiveSafetySettings, liveId string) string {
	return settings.AudioPrefix + liveId + "/"
}

func stableJobId(parts ...string) string {
	digest := sha256.Sum256([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(digest[:16])
}

func BuildLiveFrameJob(liveId, hostId, bucket string, frame interfaces.StoredSafetyObject, boosted, holdActive bool) platformevents.Job {
	frameId := stableJobId("frame", liveId, frame.Key)
	payload, _ := json.Marshal(events.LiveFrameCapturedJob{
		FrameId: frameId, LiveId: liveId, HostId: hostId, Bucket: bucket, FrameRef: frame.Key, CapturedAt: frame.LastModified.UTC().Format(time.RFC3339), Boosted: boosted, HoldActive: holdActive,
	})
	return platformevents.Job{Id: frameId, Type: events.LiveFrameCaptured, Payload: payload}
}

func BuildLiveAudioJob(liveId, hostId, bucket string, segment interfaces.StoredSafetyObject) platformevents.Job {
	segmentId := stableJobId("audio", liveId, segment.Key)
	payload, _ := json.Marshal(events.LiveAudioSegmentJob{
		SegmentId: segmentId, LiveId: liveId, HostId: hostId, Bucket: bucket, SegmentRef: segment.Key, CapturedAt: segment.LastModified.UTC().Format(time.RFC3339),
	})
	return platformevents.Job{Id: segmentId, Type: events.LiveAudioCaptured, Payload: payload}
}
