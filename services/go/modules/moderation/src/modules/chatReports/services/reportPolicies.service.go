package services

import (
	"slices"
	"time"
)

var ChatReportReasons = []string{
	"spam_or_scam", "harassment_or_bullying", "hate", "sexual_content", "child_safety", "violence_or_threats",
	"impersonation", "prohibited_items", "fraud_or_payment_scam", "self_harm", "other",
}

var EvidenceRequiredTargets = []string{"message", "conversation", "group"}

const MaximumEvidenceMessages = 100

func PriorityForReason(reason string) string {
	switch reason {
	case "child_safety":
		return "urgent"
	case "self_harm", "violence_or_threats":
		return "high"
	case "spam_or_scam":
		return "low"
	}
	return "normal"
}

func SlaFor(priority string) time.Duration {
	switch priority {
	case "urgent":
		return time.Hour
	case "high":
		return 4 * time.Hour
	case "low":
		return 72 * time.Hour
	}
	return 24 * time.Hour
}

func PriorityRank(priority string) int {
	return slices.Index([]string{"urgent", "high", "normal", "low"}, priority)
}
