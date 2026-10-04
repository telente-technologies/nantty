package services

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestCardVerificationRefundIsAttemptedImmediatelyThenRetriedThenAlerted(t *testing.T) {
	noWait := func(context.Context, time.Duration) bool { return true }
	cases := []struct {
		name         string
		outcomes     []RefundAttemptOutcome
		wantAttempts int
		wantSent     bool
		wantAlert    bool
	}{
		{"sent on the first attempt", []RefundAttemptOutcome{{Sent: true}}, 1, true, false},
		{"transient failure then sent", []RefundAttemptOutcome{{Retryable: true}, {Retryable: true}, {Sent: true}}, 3, true, false},
		{"definitive rejection alerts at once", []RefundAttemptOutcome{{Err: errors.New("refund rejected")}}, 1, false, true},
		{"retries exhausted alert", []RefundAttemptOutcome{{Retryable: true}, {Retryable: true}, {Retryable: true}, {Retryable: true}}, 4, false, true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			attempts, alerted := 0, false
			sent := RunRefundAttemptsUntilSent(context.Background(), func(context.Context) RefundAttemptOutcome {
				outcome := testCase.outcomes[min(attempts, len(testCase.outcomes)-1)]
				attempts++
				return outcome
			}, CardVerificationRefundRetryDelays, noWait, func(error) { alerted = true })
			if sent != testCase.wantSent || attempts != testCase.wantAttempts || alerted != testCase.wantAlert {
				t.Fatalf("sent %v attempts %d alerted %v", sent, attempts, alerted)
			}
		})
	}
}
