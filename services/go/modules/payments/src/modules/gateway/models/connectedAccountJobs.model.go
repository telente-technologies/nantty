package models

import (
	"strconv"
	"time"
)

const (
	JobStepCreateRecipient            = "createRecipient"
	JobStepCreateSettlementSubaccount = "createSettlementSubaccount"
	JobStepCreateEscrowSubaccount     = "createEscrowSubaccount"
	JobStepRefreshStatus              = "refreshStatus"
)

var connectedAccountJobBackoff = []time.Duration{time.Minute, 5 * time.Minute, 30 * time.Minute, 2 * time.Hour, 6 * time.Hour}

func NextConnectedAccountJobAttemptDelay(failedAttempts int) (time.Duration, bool) {
	if failedAttempts < 1 || failedAttempts > len(connectedAccountJobBackoff) {
		return 0, false
	}
	return connectedAccountJobBackoff[failedAttempts-1], true
}

func ConnectedAccountJobIdempotencyKey(step, userId string, version int) string {
	return step + ":" + userId + ":" + strconv.Itoa(version)
}

type ConnectedAccountJobView struct {
	Id            string     `json:"id"`
	Step          string     `json:"step"`
	Status        string     `json:"status"`
	AttemptCount  int        `json:"attemptCount"`
	NextAttemptAt *time.Time `json:"nextAttemptAt"`
	LastError     string     `json:"lastError,omitempty"`
	Result        any        `json:"result,omitempty"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}
