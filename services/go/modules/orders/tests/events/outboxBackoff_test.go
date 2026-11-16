package events_test

import (
	"testing"
	"time"

	"nantty/modules/orders/src/events"
)

func TestOrdersRetryBackoffIsExponentialAndBounded(t *testing.T) {
	cases := []struct {
		attempt int
		want    time.Duration
	}{
		{attempt: 1, want: 2 * time.Second},
		{attempt: 2, want: 4 * time.Second},
		{attempt: 10, want: 15 * time.Minute},
		{attempt: 21, want: 15 * time.Minute},
	}
	for _, testCase := range cases {
		if got := events.RetryBackoffAfterAttempts(testCase.attempt); got != testCase.want {
			t.Errorf("RetryBackoffAfterAttempts(%d) = %s, want %s", testCase.attempt, got, testCase.want)
		}
	}
}
