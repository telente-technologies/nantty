package services

import (
	"slices"
	"time"
)

var ContentTargetTypes = []string{"post", "comment", "clip", "live", "product", "store", "sound"}

var contentReasons = []string{"spam", "scam", "harassment", "hate", "nudity", "violence", "counterfeit", "impersonation", "misinformation", "self_harm", "other"}

var reasonAliases = map[string]string{
	"scam_or_fraud": "scam", "counterfeit_product": "counterfeit", "nudity_or_sexual_content": "nudity", "hate_or_harassment": "harassment",
	"something_else": "other", "intellectual_property": "counterfeit", "prohibited_goods": "other", "personal_data": "other",
}

const (
	ReopenAfterDismissalReports = 3
	ReduceScoreThreshold        = 0.5
	HoldScoreThreshold          = 0.85
)

func NormalizeReason(raw string) (string, bool) {
	if mapped, aliased := reasonAliases[raw]; aliased {
		return mapped, true
	}
	return raw, slices.Contains(contentReasons, raw)
}

func PriorityForReason(reason string) string {
	switch reason {
	case "self_harm", "violence":
		return "high"
	case "spam":
		return "low"
	}
	return "normal"
}

func PriorityForReportCount(reportCount int) string {
	switch {
	case reportCount >= 15:
		return "urgent"
	case reportCount >= 5:
		return "high"
	}
	return "low"
}

func HigherPriority(left, right string) string {
	if PriorityRank(left) <= PriorityRank(right) {
		return left
	}
	return right
}

func PriorityRank(priority string) int {
	return slices.Index([]string{"urgent", "high", "normal", "low"}, priority)
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

func ClassifierActionForScore(score float64, suggestedAction string) string {
	switch {
	case score >= HoldScoreThreshold || suggestedAction == "block":
		return "hold"
	case score >= ReduceScoreThreshold || suggestedAction == "review":
		return "reduce"
	}
	return "allow"
}

func VisibilityForClassifierAction(action string) string {
	switch action {
	case "hold":
		return "hidden"
	case "reduce":
		return "restricted"
	}
	return "visible"
}

func ReasonForClassifierCategory(category string) string {
	if normalized, known := NormalizeReason(category); known {
		return normalized
	}
	return "other"
}

func ShouldReopenAfterDismissal(entriesSinceDecision int) bool {
	return entriesSinceDecision >= ReopenAfterDismissalReports
}

func StrikePolicyForReason(reason string) string {
	switch reason {
	case "counterfeit":
		return "Counterfeit goods"
	case "scam":
		return "Scams and fraud"
	case "spam":
		return "Spam"
	case "harassment", "hate":
		return "Harassment and hate"
	case "nudity":
		return "Adult content"
	case "violence", "self_harm":
		return "Violence and self-harm"
	case "impersonation":
		return "Impersonation"
	}
	return "Community guidelines"
}

func SuspensionReasonCodeFor(reason string) string {
	switch reason {
	case "scam":
		return "SCAM"
	case "spam":
		return "SPAM_NETWORK"
	case "harassment", "hate":
		return "HARASSMENT"
	case "impersonation":
		return "IMPERSONATION"
	case "counterfeit":
		return "COUNTERFEIT"
	}
	return "OTHER"
}
