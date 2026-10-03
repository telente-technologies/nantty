package services

import (
	"testing"
	"time"
)

func TestPriorityAndSlaFollowTheReason(t *testing.T) {
	cases := []struct {
		reason   string
		priority string
		sla      time.Duration
	}{
		{"child_safety", "urgent", time.Hour},
		{"self_harm", "high", 4 * time.Hour},
		{"violence_or_threats", "high", 4 * time.Hour},
		{"harassment_or_bullying", "normal", 24 * time.Hour},
		{"spam_or_scam", "low", 72 * time.Hour},
	}
	for _, testCase := range cases {
		priority := PriorityForReason(testCase.reason)
		if priority != testCase.priority || SlaFor(priority) != testCase.sla {
			t.Errorf("%s: got %s/%s", testCase.reason, priority, SlaFor(priority))
		}
	}
	if PriorityRank("urgent") >= PriorityRank("low") {
		t.Error("urgent must sort before low")
	}
}

func TestEvidenceHashIsComputedOverTheCompactedArrayAsSent(t *testing.T) {
	pretty := []byte("[ {\"messageId\": \"m1\", \"senderId\": \"u1\"} ]")
	compact := []byte("[{\"messageId\":\"m1\",\"senderId\":\"u1\"}]")
	if HashEvidenceExactlyAsSent(pretty) != HashEvidenceExactlyAsSent(compact) {
		t.Fatal("whitespace must not change the hash")
	}
	if HashEvidenceExactlyAsSent(compact) == HashEvidenceExactlyAsSent([]byte("[{\"messageId\":\"m2\"}]")) {
		t.Fatal("different evidence must hash differently")
	}
}
