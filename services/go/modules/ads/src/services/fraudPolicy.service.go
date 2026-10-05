package services

const (
	FraudStatusClean   = "clean"
	FraudStatusInvalid = "invalid"
)

type FraudThresholds struct {
	InvalidScore           float64
	MinimumMillisToClick   int64
	MaximumClicksPerMinute int
}

type FraudSignals struct {
	EventKind                string
	MillisSinceServed        int64
	ClicksByViewerLastMinute int
	KnownBotUserAgent        bool
	ModelScore               *float64
}

type FraudVerdict struct {
	Status string
	Score  float64
	Reason string
}

func DefaultFraudThresholds() FraudThresholds {
	return FraudThresholds{InvalidScore: 0.9, MinimumMillisToClick: 400, MaximumClicksPerMinute: 8}
}

func EvaluateFraudPolicy(signals FraudSignals, thresholds FraudThresholds) FraudVerdict {
	score := 0.0
	if signals.ModelScore != nil {
		score = *signals.ModelScore
	}
	switch {
	case signals.KnownBotUserAgent:
		return FraudVerdict{Status: FraudStatusInvalid, Score: 1, Reason: "bot_user_agent"}
	case signals.EventKind == "click" && signals.MillisSinceServed < thresholds.MinimumMillisToClick:
		return FraudVerdict{Status: FraudStatusInvalid, Score: max(score, 0.95), Reason: "click_too_fast"}
	case signals.EventKind == "click" && signals.ClicksByViewerLastMinute > thresholds.MaximumClicksPerMinute:
		return FraudVerdict{Status: FraudStatusInvalid, Score: max(score, 0.95), Reason: "click_velocity"}
	case signals.ModelScore != nil && score >= thresholds.InvalidScore:
		return FraudVerdict{Status: FraudStatusInvalid, Score: score, Reason: "model_score"}
	}
	return FraudVerdict{Status: FraudStatusClean, Score: score}
}

func IsViewQualified(claims AdTokenClaims, watchMs, visiblePercent int, completed bool) bool {
	if completed {
		return true
	}
	return watchMs >= claims.QualifyWatchMs && visiblePercent >= claims.QualifyVisiblePct
}
