package models

import "time"

const (
	DunningRetry     = "retry"
	DunningGrace     = "grace"
	DunningDowngrade = "downgrade"

	DunningGraceDays            = 7
	TrialUnpaidFeatureLimitDays = 3
)

var DunningRetryOffsetDays = []int{1, 3, 5}

type DunningStep struct {
	Action        string    `json:"action"`
	At            time.Time `json:"at"`
	RetriesLeft   int       `json:"retriesLeft"`
	FailedAttempt int       `json:"failedAttempt"`
}

func days(count int) time.Duration { return time.Duration(count) * 24 * time.Hour }

func retryOffsetsFor(trialConversion bool) []int {
	if trialConversion {
		return []int{1, TrialUnpaidFeatureLimitDays}
	}
	return DunningRetryOffsetDays
}

func NextDunningStep(dueAt time.Time, failedAttempts int, trialConversion bool) DunningStep {
	offsets := retryOffsetsFor(trialConversion)
	step := DunningStep{FailedAttempt: failedAttempts}
	switch {
	case failedAttempts >= 1 && failedAttempts <= len(offsets):
		step.Action, step.At, step.RetriesLeft = DunningRetry, dueAt.Add(days(offsets[failedAttempts-1])), len(offsets)-failedAttempts+1
	case trialConversion:
		step.Action, step.At = DunningDowngrade, dueAt.Add(days(TrialUnpaidFeatureLimitDays))
	case failedAttempts == len(offsets)+1:
		step.Action, step.At = DunningGrace, GraceEndsAt(dueAt)
	default:
		step.Action, step.At = DunningDowngrade, GraceEndsAt(dueAt)
	}
	return step
}

func GraceEndsAt(dueAt time.Time) time.Time {
	return dueAt.Add(days(DunningRetryOffsetDays[len(DunningRetryOffsetDays)-1] + DunningGraceDays))
}

func DowngradeAt(dueAt time.Time, trialConversion bool) time.Time {
	if trialConversion {
		return dueAt.Add(days(TrialUnpaidFeatureLimitDays))
	}
	return GraceEndsAt(dueAt)
}
