package configs

import (
	"time"

	platformconfig "zudomart/platform/config"
)

type AccessSecuritySettings struct {
	FailedChallengesBeforeSuspension  int
	ChallengesBeforeProbingSuspension int
	PolicyWindow                      time.Duration
	ClearedFor                        time.Duration
	AutoSuspensionDays                int
	BotScoreThreshold                 float64
	BotScoreWithHardSignalThreshold   float64
	BotScoresQueue                    string
	EventRetention                    time.Duration
}

func DefaultAccessSecuritySettings() AccessSecuritySettings {
	return AccessSecuritySettings{
		FailedChallengesBeforeSuspension: 5, ChallengesBeforeProbingSuspension: 3, PolicyWindow: 24 * time.Hour, ClearedFor: 24 * time.Hour,
		AutoSuspensionDays: 7, BotScoreThreshold: 0.85, BotScoreWithHardSignalThreshold: 0.6, BotScoresQueue: "intelligence-trust-bot-scores",
	}
}

func readAccessSecuritySettings(reader *platformconfig.EnvironmentReader) AccessSecuritySettings {
	defaults := DefaultAccessSecuritySettings()
	return AccessSecuritySettings{
		FailedChallengesBeforeSuspension:  reader.ReadIntegerOrDefault("SECURITY_FAILED_CHALLENGES_BEFORE_SUSPENSION", defaults.FailedChallengesBeforeSuspension),
		ChallengesBeforeProbingSuspension: reader.ReadIntegerOrDefault("SECURITY_CHALLENGES_BEFORE_PROBING_SUSPENSION", defaults.ChallengesBeforeProbingSuspension),
		PolicyWindow:                      time.Duration(reader.ReadIntegerOrDefault("SECURITY_POLICY_WINDOW_HOURS", 24)) * time.Hour,
		ClearedFor:                        time.Duration(reader.ReadIntegerOrDefault("SECURITY_CHALLENGE_CLEARED_HOURS", 24)) * time.Hour,
		AutoSuspensionDays:                reader.ReadIntegerOrDefault("SECURITY_AUTO_SUSPENSION_DAYS", defaults.AutoSuspensionDays),
		BotScoreThreshold:                 float64(reader.ReadIntegerOrDefault("SECURITY_BOT_SCORE_THRESHOLD_PERCENT", 85)) / 100,
		BotScoreWithHardSignalThreshold:   float64(reader.ReadIntegerOrDefault("SECURITY_BOT_SCORE_HARD_SIGNAL_THRESHOLD_PERCENT", 60)) / 100,
		BotScoresQueue:                    reader.ReadStringOrDefault("INTELLIGENCE_TRUST_BOT_SCORES_QUEUE", defaults.BotScoresQueue),
		EventRetention:                    time.Duration(reader.ReadIntegerOrDefault("SECURITY_EVENT_RETENTION_DAYS", 365)) * 24 * time.Hour,
	}
}
