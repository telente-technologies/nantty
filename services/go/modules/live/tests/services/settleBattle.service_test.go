package services_test

import (
	"testing"
	"time"

	"nantty/modules/live/src/services"
)

func TestBattleSettlementRetryDelayIsBounded(t *testing.T) {
	tests := []struct {
		name    string
		attempt int
		want    time.Duration
	}{
		{name: "first retry", attempt: 1, want: 250 * time.Millisecond},
		{name: "exponential retry", attempt: 4, want: 2 * time.Second},
		{name: "maximum delay", attempt: 8, want: 30 * time.Second},
		{name: "very large attempt", attempt: 100, want: 30 * time.Second},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := services.BattleSettlementRetryDelay(test.attempt); got != test.want {
				t.Fatalf("BattleSettlementRetryDelay(%d) = %s, want %s", test.attempt, got, test.want)
			}
		})
	}
}

func TestBattleSettlementRetryCeilingIsFinite(t *testing.T) {
	if services.MaxBattleSettlementAttempts < 1 {
		t.Fatal("settlement retries must have a positive attempt ceiling")
	}
	if services.MaxBattleSettlementAttempts != 8 {
		t.Fatalf("unexpected settlement attempt ceiling: %d", services.MaxBattleSettlementAttempts)
	}
}
