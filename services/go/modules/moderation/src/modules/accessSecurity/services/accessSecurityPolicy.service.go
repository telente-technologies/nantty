package services

import (
	"slices"

	"nantty/modules/moderation/src/configs"
)

const (
	RequirementNone        = "none"
	RequirementOnce        = "once"
	RequirementEveryAction = "everyAction"

	ReasonAccessProbing = "access_probing"
	ReasonSuspectedBot  = "suspected_bot"

	AutoSuspensionReason     = "Security: repeated unauthorised access attempts"
	AutoSuspensionReasonCode = "SECURITY"
	AutoSuspensionSource     = "security"
)

type RecentHistory struct {
	Violations         int
	ChallengesRequired int
	PassedChallenges   int
	FailedChallenges   int
}

type PolicyDecision struct {
	RequireChallenge bool
	Suspend          bool
	OpenCase         bool
	ClearChallenge   bool
}

func EffectiveThresholds(settings configs.AccessSecuritySettings) configs.AccessSecuritySettings {
	defaults := configs.DefaultAccessSecuritySettings()
	if settings.FailedChallengesBeforeSuspension <= 0 {
		settings.FailedChallengesBeforeSuspension = defaults.FailedChallengesBeforeSuspension
	}
	if settings.ChallengesBeforeProbingSuspension <= 0 {
		settings.ChallengesBeforeProbingSuspension = defaults.ChallengesBeforeProbingSuspension
	}
	if settings.PolicyWindow <= 0 {
		settings.PolicyWindow = defaults.PolicyWindow
	}
	if settings.ClearedFor <= 0 {
		settings.ClearedFor = defaults.ClearedFor
	}
	if settings.AutoSuspensionDays <= 0 {
		settings.AutoSuspensionDays = defaults.AutoSuspensionDays
	}
	if settings.BotScoreThreshold <= 0 {
		settings.BotScoreThreshold = defaults.BotScoreThreshold
	}
	if settings.BotScoreWithHardSignalThreshold <= 0 {
		settings.BotScoreWithHardSignalThreshold = defaults.BotScoreWithHardSignalThreshold
	}
	if settings.BotScoresQueue == "" {
		settings.BotScoresQueue = defaults.BotScoresQueue
	}
	return settings
}

func DecideAfterAccessViolation(alreadySuspended bool, history RecentHistory, thresholds configs.AccessSecuritySettings) PolicyDecision {
	if alreadySuspended {
		return PolicyDecision{}
	}
	if history.ChallengesRequired >= thresholds.ChallengesBeforeProbingSuspension {
		return PolicyDecision{Suspend: true, OpenCase: true}
	}
	return PolicyDecision{RequireChallenge: true, OpenCase: true}
}

func DecideAfterChallengeOutcome(passed, alreadySuspended bool, history RecentHistory, thresholds configs.AccessSecuritySettings) PolicyDecision {
	if alreadySuspended {
		return PolicyDecision{}
	}
	if passed {
		return PolicyDecision{ClearChallenge: true}
	}
	if history.FailedChallenges >= thresholds.FailedChallengesBeforeSuspension {
		return PolicyDecision{Suspend: true, OpenCase: true}
	}
	return PolicyDecision{}
}

type BotEvidence struct {
	Score              float64
	ReasonCodes        []string
	HeadlessReported   bool
	AttestationVerdict string
}

func DecideSuspectedBot(evidence BotEvidence, thresholds configs.AccessSecuritySettings) (bool, []string) {
	reasons := []string{}
	if evidence.AttestationVerdict == "failed" && evidence.Score >= thresholds.BotScoreWithHardSignalThreshold {
		reasons = append(reasons, "device_integrity_failed")
	}
	if evidence.HeadlessReported && evidence.Score >= thresholds.BotScoreWithHardSignalThreshold {
		reasons = append(reasons, "headless_client")
	}
	distinct := slices.Compact(slices.Sorted(slices.Values(evidence.ReasonCodes)))
	if evidence.Score >= thresholds.BotScoreThreshold && len(distinct) >= 2 {
		reasons = append(reasons, "behaviour_score")
	}
	return len(reasons) > 0, reasons
}

func ChallengeRequirement(suspended, suspectedBot, challengeRequired bool) (string, string) {
	switch {
	case suspended:
		return RequirementNone, ""
	case suspectedBot:
		return RequirementEveryAction, ReasonSuspectedBot
	case challengeRequired:
		return RequirementOnce, ReasonAccessProbing
	}
	return RequirementNone, ""
}

func SeverityFor(history RecentHistory, suspended bool) string {
	switch {
	case suspended || history.Violations >= 5:
		return "high"
	case history.Violations >= 2 || history.FailedChallenges >= 2:
		return "medium"
	}
	return "low"
}
