package middlewares_test

import (
	"testing"
	"time"

	"nantty/modules/admin/src/middlewares"
)

func TestLimiterAllowsBurstThenRefills(t *testing.T) {
	clock := time.Unix(1_000, 0)
	limiter := middlewares.NewAttemptRateLimiter(3, 10*time.Second, func() time.Time { return clock })
	for attempt := 1; attempt <= 3; attempt++ {
		if !limiter.Allow("ip|a@b.co") {
			t.Fatalf("attempt %d should pass", attempt)
		}
	}
	if limiter.Allow("ip|a@b.co") {
		t.Fatal("fourth attempt must be refused")
	}
	if !limiter.Allow("other-key") {
		t.Fatal("keys are independent")
	}
	clock = clock.Add(10 * time.Second)
	if !limiter.Allow("ip|a@b.co") || limiter.Allow("ip|a@b.co") {
		t.Fatal("exactly one token should have refilled")
	}
}
