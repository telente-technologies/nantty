package services

import (
	"slices"
	"testing"
	"time"
)

func TestSpacesAreSupportedContentReportTargets(t *testing.T) {
	if !slices.Contains(ContentTargetTypes, "space") {
		t.Fatal("Space reports must enter the content moderation queue")
	}
}

func TestClientReasonsMapToTheAdminReasonSet(t *testing.T) {
	cases := map[string]string{"scam_or_fraud": "scam", "counterfeit_product": "counterfeit", "nudity_or_sexual_content": "nudity", "hate_or_harassment": "harassment", "something_else": "other", "spam": "spam", "violence": "violence", "prohibited_goods": "other", "prohibited_items": "other"}
	for raw, want := range cases {
		if got, known := NormalizeReason(raw); !known || got != want {
			t.Errorf("%s -> %s %v", raw, got, known)
		}
	}
	if _, known := NormalizeReason("made_up"); known {
		t.Fatal("unknown reasons are rejected")
	}
}

func TestPriorityRisesWithReportVolumeAndSlaFollowsPriority(t *testing.T) {
	if HigherPriority("low", PriorityForReportCount(5)) != "high" || HigherPriority("urgent", "low") != "urgent" || HigherPriority(PriorityForReason("self_harm"), "low") != "high" {
		t.Fatal("priority is the higher of the reason and the volume priority")
	}
	if PriorityForReportCount(1) != "low" || PriorityForReportCount(15) != "urgent" {
		t.Fatal("volume thresholds are 5 for high and 15 for urgent")
	}
	for priority, want := range map[string]time.Duration{"urgent": time.Hour, "high": 4 * time.Hour, "normal": 24 * time.Hour, "low": 72 * time.Hour} {
		if SlaFor(priority) != want {
			t.Errorf("%s sla", priority)
		}
	}
}

func TestClassifierScoresOnlyAdviseAllowReduceOrHold(t *testing.T) {
	cases := []struct {
		score     float64
		suggested string
		action    string
		hidden    string
	}{
		{0.2, "allow", "allow", "visible"}, {0.5, "review", "reduce", "restricted"}, {0.84, "review", "reduce", "restricted"}, {0.85, "block", "hold", "hidden"}, {0.3, "block", "hold", "hidden"},
	}
	for _, testCase := range cases {
		action := ClassifierActionForScore(testCase.score, testCase.suggested)
		if action != testCase.action || VisibilityForClassifierAction(action) != testCase.hidden {
			t.Errorf("%v/%s -> %s/%s", testCase.score, testCase.suggested, action, VisibilityForClassifierAction(action))
		}
	}
	if ReasonForClassifierCategory("prohibited_goods") != "other" || ReasonForClassifierCategory("scam") != "scam" {
		t.Fatal("classifier categories map to report reasons")
	}
}

func TestDismissedReportsReopenAfterThreeFreshReports(t *testing.T) {
	if ShouldReopenAfterDismissal(2) || !ShouldReopenAfterDismissal(3) {
		t.Fatal("three fresh reports reopen a dismissed report")
	}
	if StrikePolicyForReason("counterfeit") != "Counterfeit goods" || SuspensionReasonCodeFor("scam") != "SCAM" || SuspensionReasonCodeFor("nudity") != "OTHER" {
		t.Fatal("policy and suspension codes follow the reason")
	}
}
