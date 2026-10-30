package services

import (
	"testing"
	"time"
)

func TestBattleSettlementRetryDelayIsBounded(t *testing.T) {
	tests := []struct {
		name    string
		attempt int
		want    time.Duration
	}{
		{name: "first retry", attempt: 1, want: 250 * time.Millisecond},
		{name: "exponential retry", attempt: 4, want: 2 * time.Second},
		{name: "maximum delay", attempt: 8, want: battleSettlementRetryMax},
		{name: "very large attempt", attempt: 100, want: battleSettlementRetryMax},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := battleSettlementRetryDelay(test.attempt); got != test.want {
				t.Fatalf("battleSettlementRetryDelay(%d) = %s, want %s", test.attempt, got, test.want)
			}
		})
	}
}

func TestBattleSettlementRetryCeilingIsFinite(t *testing.T) {
	if maxBattleSettlementAttempts < 1 {
		t.Fatal("settlement retries must have a positive attempt ceiling")
	}
	if maxBattleSettlementAttempts != 8 {
		t.Fatalf("unexpected settlement attempt ceiling: %d", maxBattleSettlementAttempts)
	}
}
