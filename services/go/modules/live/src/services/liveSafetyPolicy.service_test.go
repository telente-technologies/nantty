package services

import (
	"encoding/json"
	"testing"
	"time"

	"nantty/modules/live/src/configs"
	"nantty/modules/live/src/events"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/interfaces"
)

func safetySettings() configs.LiveSafetySettings {
	return configs.LiveSafetySettings{FrameInterval: 5 * time.Second, BoostedFrameInterval: 2 * time.Second, FramesPrefix: "live-safety/frames/", AudioPrefix: "live-safety/audio/"}
}

func TestFrameIntervalSpeedsUpWhileSamplingIsBoosted(t *testing.T) {
	now := time.Now()
	later, earlier := now.Add(time.Minute), now.Add(-time.Minute)
	if interval, boosted := FrameIntervalForLive(safetySettings(), &ent.LiveSafetyState{SamplingBoostUntil: &later}, now); interval != 2*time.Second || !boosted {
		t.Fatalf("boosted live should sample every 2s, got %v %v", interval, boosted)
	}
	if interval, boosted := FrameIntervalForLive(safetySettings(), &ent.LiveSafetyState{SamplingBoostUntil: &earlier}, now); interval != 5*time.Second || boosted {
		t.Fatalf("expired boost falls back to 5s, got %v %v", interval, boosted)
	}
	if interval, _ := FrameIntervalForLive(safetySettings(), nil, now); interval != 5*time.Second {
		t.Fatalf("lives without state use the default interval, got %v", interval)
	}
}

func TestFrameSampleIsDueOncePerInterval(t *testing.T) {
	now := time.Now()
	recent, old := now.Add(-3*time.Second), now.Add(-6*time.Second)
	if IsFrameSampleDue(&recent, now, 5*time.Second) || !IsFrameSampleDue(&old, now, 5*time.Second) || !IsFrameSampleDue(nil, now, 5*time.Second) {
		t.Fatal("frame sampling cadence is wrong")
	}
}

func TestNewestFramePicksTheLatestImageAndIgnoresOtherFiles(t *testing.T) {
	base := time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)
	objects := []interfaces.StoredSafetyObject{
		{Key: "live-safety/frames/l1/frame_20261004120000.jpeg", LastModified: base},
		{Key: "live-safety/frames/l1/frame_20261004120002.jpeg", LastModified: base.Add(2 * time.Second)},
		{Key: "live-safety/frames/l1/manifest.json", LastModified: base.Add(3 * time.Second)},
	}
	newest, found := NewestSafetyObject(objects, ".jpeg", ".jpg")
	if !found || newest.Key != "live-safety/frames/l1/frame_20261004120002.jpeg" {
		t.Fatalf("unexpected newest frame %+v", newest)
	}
	if LastKey(objects) != "live-safety/frames/l1/manifest.json" {
		t.Fatal("the cursor must move past every listed object")
	}
	if segments := AudioSegmentsToTranscribe([]interfaces.StoredSafetyObject{{Key: "a/index.m3u8"}, {Key: "a/seg_1.ts"}}); len(segments) != 1 {
		t.Fatalf("only audio segments are transcribed, got %d", len(segments))
	}
}

func TestFrameJobsAreStableAndCarryTheFrameReference(t *testing.T) {
	frame := interfaces.StoredSafetyObject{Key: "live-safety/frames/l1/frame_1.jpeg", LastModified: time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)}
	first, second := BuildLiveFrameJob("l1", "h1", "bucket", frame, true, false), BuildLiveFrameJob("l1", "h1", "bucket", frame, true, false)
	if first.Id != second.Id || first.Type != events.LiveFrameCaptured {
		t.Fatalf("frame jobs must be deterministic, got %s and %s", first.Id, second.Id)
	}
	var payload events.LiveFrameCapturedJob
	if err := json.Unmarshal(first.Payload, &payload); err != nil || payload.FrameRef != frame.Key || payload.Bucket != "bucket" || !payload.Boosted || payload.CapturedAt != "2026-10-04T12:00:00Z" {
		t.Fatalf("unexpected payload %+v (%v)", payload, err)
	}
	if FramePrefixForLive(safetySettings(), "l1") != "live-safety/frames/l1/" {
		t.Fatal("frame prefix must be scoped per live")
	}
}

func TestSafetyViewHidesTheReasonFromViewers(t *testing.T) {
	now := time.Now()
	held := &ent.LiveSafetyState{HoldActive: true, HoldReason: "We paused your live because it may show nudity or sexual content.", HoldCategory: "sexual_explicit", HoldStartedAt: &now}
	viewer := PresentLiveSafety(held, false, now)
	if viewer == nil || viewer.State != "paused" || viewer.HostReason != nil || viewer.Category != nil || viewer.ViewerMessage != events.ViewerPausedMessage {
		t.Fatalf("viewers see a generic paused state only, got %+v", viewer)
	}
	host := PresentLiveSafety(held, true, now)
	if host == nil || host.HostReason == nil || !host.Appealable {
		t.Fatalf("the host sees the reason and can appeal, got %+v", host)
	}
	warnedAt := now.Add(-30 * time.Second)
	warned := &ent.LiveSafetyState{WarningMessage: "Please adjust what's on camera.", WarnedAt: &warnedAt}
	if PresentLiveSafety(warned, false, now) != nil {
		t.Fatal("warnings are only shown to the host")
	}
	if view := PresentLiveSafety(warned, true, now); view == nil || view.State != "warning" || view.WarningMessage == nil {
		t.Fatalf("the host sees a recent warning, got %+v", view)
	}
}
