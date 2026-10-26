package services

import (
	"slices"
	"time"

	"nantty/modules/moderation/src/configs"
)

const (
	ActionNone   = "none"
	ActionReview = "review"
	ActionWarn   = "warn"
	ActionHold   = "hold"
)

var SevereCategories = []string{"child_safety", "sexual_explicit", "graphic_violence", "self_harm", "weapon_threat", "gore"}

var UrgentReportReasons = []string{"child_safety", "self_harm", "violence"}

var liveReportReasonAliases = map[string]string{
	"nudity_or_sexual_content": "sexual_content", "nudity": "sexual_content", "violence_or_threats": "violence", "hate_or_harassment": "harassment",
	"scam_or_fraud": "scam", "fraud": "scam", "fraud_or_payment_scam": "scam", "spam_or_scam": "scam", "something_else": "other", "counterfeit": "intellectual_property",
}

var LiveReportReasons = []string{"child_safety", "self_harm", "violence", "sexual_content", "hate", "harassment", "scam", "intellectual_property", "other"}

type CategoryConfidence struct {
	Category   string  `json:"category"`
	Confidence float64 `json:"confidence"`
}

type SignalAssessment struct {
	Categories    []CategoryConfidence
	HashMatch     bool
	ActiveStrikes int
}

type Decision struct {
	Action        string
	Category      string
	Confidence    float64
	Priority      string
	BoostSampling bool
}

func IsSevereCategory(category string) bool {
	return slices.Contains(SevereCategories, category)
}

func TopCategory(categories []CategoryConfidence) CategoryConfidence {
	best := CategoryConfidence{}
	for _, candidate := range categories {
		if candidate.Confidence > best.Confidence || (candidate.Confidence == best.Confidence && IsSevereCategory(candidate.Category) && !IsSevereCategory(best.Category)) {
			best = candidate
		}
	}
	return best
}

func DecideLiveSafetyAction(settings configs.LiveSafetySettings, assessment SignalAssessment) Decision {
	if assessment.HashMatch {
		return Decision{Action: ActionHold, Category: "child_safety", Confidence: 1, Priority: "urgent", BoostSampling: true}
	}
	holdThreshold := settings.HoldConfidence
	if assessment.ActiveStrikes >= settings.RepeatOffenderStrike {
		holdThreshold = settings.RepeatHoldConfidence
	}
	var severe, other CategoryConfidence
	for _, candidate := range assessment.Categories {
		if IsSevereCategory(candidate.Category) && candidate.Confidence > severe.Confidence {
			severe = candidate
		} else if !IsSevereCategory(candidate.Category) && candidate.Confidence > other.Confidence {
			other = candidate
		}
	}
	switch {
	case severe.Confidence >= holdThreshold:
		return Decision{Action: ActionHold, Category: severe.Category, Confidence: severe.Confidence, Priority: "urgent", BoostSampling: true}
	case severe.Confidence >= settings.WarnConfidence:
		return Decision{Action: ActionWarn, Category: severe.Category, Confidence: severe.Confidence, Priority: "urgent", BoostSampling: true}
	case other.Confidence >= holdThreshold:
		return Decision{Action: ActionWarn, Category: other.Category, Confidence: other.Confidence, Priority: "high", BoostSampling: true}
	case severe.Confidence >= settings.ReviewConfidence || other.Confidence >= settings.WarnConfidence:
		top := TopCategory([]CategoryConfidence{severe, other})
		return Decision{Action: ActionReview, Category: top.Category, Confidence: top.Confidence, Priority: "normal", BoostSampling: true}
	}
	top := TopCategory(assessment.Categories)
	return Decision{Action: ActionNone, Category: top.Category, Confidence: top.Confidence, Priority: "low"}
}

func ShouldWarnHostAgain(lastWarnedAt *time.Time, now time.Time, cooldown time.Duration) bool {
	return lastWarnedAt == nil || now.Sub(*lastWarnedAt) >= cooldown
}

func IsReportSurge(settings configs.LiveSafetySettings, reportTimes []time.Time, now time.Time) bool {
	recent := 0
	for _, reportedAt := range reportTimes {
		if now.Sub(reportedAt) <= settings.ReportSurgeWindow {
			recent++
		}
	}
	return recent >= settings.ReportSurgeCount
}

func NormalizeLiveReportReason(raw string) (string, bool) {
	if mapped, aliased := liveReportReasonAliases[raw]; aliased {
		return mapped, true
	}
	return raw, slices.Contains(LiveReportReasons, raw)
}

func PriorityForLiveReportReason(reason string) string {
	if slices.Contains(UrgentReportReasons, reason) {
		return "urgent"
	}
	if reason == "sexual_content" || reason == "hate" {
		return "high"
	}
	return "normal"
}

func HigherPriority(left, right string) string {
	if PriorityRank(left) <= PriorityRank(right) {
		return left
	}
	return right
}

func PriorityRank(priority string) int {
	rank := slices.Index([]string{"urgent", "high", "normal", "low"}, priority)
	if rank < 0 {
		return 3
	}
	return rank
}

func SlaForPriority(priority string) time.Duration {
	switch priority {
	case "urgent":
		return 15 * time.Minute
	case "high":
		return time.Hour
	case "low":
		return 24 * time.Hour
	}
	return 4 * time.Hour
}

func HostFacingReasonForCategory(category string) string {
	switch category {
	case "child_safety":
		return "We paused your live while our safety team checks it for child safety concerns."
	case "sexual_explicit", "sexual_suggestive":
		return "We paused your live because it may show nudity or sexual content."
	case "graphic_violence", "gore":
		return "We paused your live because it may show graphic violence."
	case "self_harm":
		return "We paused your live because it may show self-harm. If you need support, help is available."
	case "weapon_threat":
		return "We paused your live because it may show a weapon being used to threaten someone."
	}
	return "We paused your live while our safety team reviews it."
}

func HostWarningMessageForCategory(category string) string {
	switch category {
	case "sexual_explicit", "sexual_suggestive":
		return "Your live may be showing nudity or sexual content. Please adjust what's on camera or your live may be paused."
	case "graphic_violence", "gore", "weapon_threat":
		return "Your live may be showing violence or a weapon. Please stop or your live may be paused."
	case "self_harm":
		return "Your live may be showing self-harm. If you're struggling, please reach out to someone you trust or a local helpline."
	case "hate", "hate_symbols":
		return "Your live may include hateful content. Please follow the community guidelines."
	}
	return "Your live may break our community guidelines. Please review what's on camera."
}

func StrikePolicyForLiveCategory(category string) string {
	switch category {
	case "sexual_explicit", "sexual_suggestive", "sexual_content":
		return "Adult content"
	case "graphic_violence", "gore", "weapon_threat", "violence", "self_harm":
		return "Violence and self-harm"
	case "child_safety":
		return "Child safety"
	case "hate", "hate_symbols", "harassment":
		return "Harassment and hate"
	case "scam":
		return "Scams and fraud"
	}
	return "Community guidelines"
}
