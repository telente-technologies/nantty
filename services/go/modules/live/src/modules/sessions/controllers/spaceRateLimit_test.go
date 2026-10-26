package controllers

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestSpaceRateLimiterIsPerActorAndRefills(t *testing.T) {
	now := time.Unix(100, 0)
	limiter := newSpaceRateLimiter(2, time.Minute)
	limiter.now = func() time.Time { return now }
	a, b := uuid.New(), uuid.New()
	if !limiter.allow(a) || !limiter.allow(a) || limiter.allow(a) {
		t.Fatal("actor should be limited after two actions")
	}
	if !limiter.allow(b) {
		t.Fatal("rate limit should be isolated per actor")
	}
	now = now.Add(time.Minute)
	if !limiter.allow(a) {
		t.Fatal("rate limit should refill after its window")
	}
}
