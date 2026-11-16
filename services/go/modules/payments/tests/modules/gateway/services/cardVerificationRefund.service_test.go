package services_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"nantty/modules/payments/src/modules/gateway/services"
)

func TestCardVerificationRefundIsAttemptedImmediatelyThenRetriedThenAlerted(t *testing.T) {
	noWait := func(context.Context, time.Duration) bool { return true }
	cases := []struct {
		name         string
		outcomes     []services.RefundAttemptOutcome
		wantAttempts int
		wantSent     bool
		wantAlert    bool
	}{
		{"sent on the first attempt", []services.RefundAttemptOutcome{{Sent: true}}, 1, true, false},
		{"transient failure then sent", []services.RefundAttemptOutcome{{Retryable: true}, {Retryable: true}, {Sent: true}}, 3, true, false},
		{"definitive rejection alerts at once", []services.RefundAttemptOutcome{{Err: errors.New("refund rejected")}}, 1, false, true},
		{"retries exhausted alert", []services.RefundAttemptOutcome{{Retryable: true}, {Retryable: true}, {Retryable: true}, {Retryable: true}}, 4, false, true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			attempts, alerted := 0, false
			sent := services.RunRefundAttemptsUntilSent(context.Background(), func(context.Context) services.RefundAttemptOutcome {
				outcome := testCase.outcomes[min(attempts, len(testCase.outcomes)-1)]
				attempts++
				return outcome
			}, services.CardVerificationRefundRetryDelays, noWait, func(error) { alerted = true })
			if sent != testCase.wantSent || attempts != testCase.wantAttempts || alerted != testCase.wantAlert {
				t.Fatalf("sent %v attempts %d alerted %v", sent, attempts, alerted)
			}
		})
	}
}
