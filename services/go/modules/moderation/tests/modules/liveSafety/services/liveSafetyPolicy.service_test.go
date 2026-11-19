package services_test

import (
	"testing"
	"time"

	"nantty/modules/moderation/src/configs"
	"nantty/modules/moderation/src/modules/liveSafety/services"
)

func TestDecideLiveSafetyActionHoldsSevereHighConfidenceSignals(t *testing.T) {
	settings := configs.DefaultLiveSafetySettings()
	cases := []struct {
		name       string
		assessment services.SignalAssessment
		action     string
		category   string
		priority   string
	}{
		{"explicit nudity at 0.97 holds", services.SignalAssessment{Categories: []services.CategoryConfidence{{Category: "sexual_explicit", Confidence: 0.97}}}, services.ActionHold, "sexual_explicit", "urgent"},
		{"graphic violence at 0.80 warns", services.SignalAssessment{Categories: []services.CategoryConfidence{{Category: "graphic_violence", Confidence: 0.80}}}, services.ActionWarn, "graphic_violence", "urgent"},
		{"repeat offender holds at 0.82", services.SignalAssessment{Categories: []services.CategoryConfidence{{Category: "weapon_threat", Confidence: 0.82}}, ActiveStrikes: 2}, services.ActionHold, "weapon_threat", "urgent"},
		{"non severe at 0.95 only warns", services.SignalAssessment{Categories: []services.CategoryConfidence{{Category: "drugs", Confidence: 0.95}}}, services.ActionWarn, "drugs", "high"},
		{"severe at 0.55 queues review", services.SignalAssessment{Categories: []services.CategoryConfidence{{Category: "self_harm", Confidence: 0.55}}}, services.ActionReview, "self_harm", "normal"},
		{"swimwear at 0.40 does nothing", services.SignalAssessment{Categories: []services.CategoryConfidence{{Category: "suggestive", Confidence: 0.40}}}, services.ActionNone, "suggestive", "low"},
		{"hash match always holds", services.SignalAssessment{HashMatch: true}, services.ActionHold, "child_safety", "urgent"},
		{"no signal does nothing", services.SignalAssessment{}, services.ActionNone, "", "low"},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			decision := services.DecideLiveSafetyAction(settings, testCase.assessment)
			if decision.Action != testCase.action || decision.Category != testCase.category || decision.Priority != testCase.priority {
				t.Fatalf("got %+v, want action %s category %s priority %s", decision, testCase.action, testCase.category, testCase.priority)
			}
		})
	}
}

func TestReportSurgeNeedsEnoughReportsInsideTheWindow(t *testing.T) {
	settings := configs.DefaultLiveSafetySettings()
	now := time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)
	recent := []time.Time{now.Add(-10 * time.Second), now.Add(-30 * time.Second), now.Add(-time.Minute), now.Add(-2 * time.Minute)}
	if services.IsReportSurge(settings, recent, now) {
		t.Fatal("four reports must not count as a surge")
	}
	if !services.IsReportSurge(settings, append(recent, now), now) {
		t.Fatal("five reports inside three minutes is a surge")
	}
	if services.IsReportSurge(settings, append(recent, now.Add(-10*time.Minute)), now) {
		t.Fatal("a report outside the window must not count")
	}
}

func TestLiveReportReasonsNormalizeAndPrioritize(t *testing.T) {
	for raw, want := range map[string]string{"nudity_or_sexual_content": "sexual_content", "fraud": "scam", "child_safety": "child_safety", "intellectual_property": "intellectual_property"} {
		got, known := services.NormalizeLiveReportReason(raw)
		if !known || got != want {
			t.Fatalf("%s normalized to %s (%v), want %s", raw, got, known, want)
		}
	}
	if _, known := services.NormalizeLiveReportReason("made_up"); known {
		t.Fatal("unknown reasons must be rejected")
	}
	for _, reason := range []string{"child_safety", "self_harm", "violence"} {
		if services.PriorityForLiveReportReason(reason) != "urgent" {
			t.Fatalf("%s must be urgent", reason)
		}
	}
	if services.PriorityForLiveReportReason("scam") != "normal" {
		t.Fatal("scam reports are normal priority")
	}
}

func TestHostWarningsRespectTheCooldown(t *testing.T) {
	now := time.Now()
	recently := now.Add(-time.Minute)
	if services.ShouldWarnHostAgain(&recently, now, 2*time.Minute) {
		t.Fatal("must not warn twice inside the cooldown")
	}
	if !services.ShouldWarnHostAgain(nil, now, 2*time.Minute) {
		t.Fatal("first warning always goes out")
	}
}
