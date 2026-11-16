package utils_test

import (
	"testing"
	"time"

	"nantty/modules/users/src/utils"
)

func TestIpRateLimiterRefillsAndIsolatesKeys(t *testing.T) {
	current := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	limiter := utils.NewIpRateLimiter(3, func() time.Time { return current })
	for attempt := 1; attempt <= 3; attempt++ {
		if !limiter.Allow("1.1.1.1") {
			t.Fatalf("attempt %d should pass", attempt)
		}
	}
	if limiter.Allow("1.1.1.1") {
		t.Fatal("fourth attempt must be limited")
	}
	if !limiter.Allow("2.2.2.2") {
		t.Fatal("other keys are independent")
	}
	current = current.Add(30 * time.Second)
	if !limiter.Allow("1.1.1.1") {
		t.Fatal("tokens refill over time")
	}
}
