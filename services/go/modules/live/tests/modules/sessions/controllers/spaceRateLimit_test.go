package controllers_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"nantty/modules/live/src/modules/sessions/controllers"
)

func TestSpaceRateLimiterIsPerActorAndRefills(t *testing.T) {
	now := time.Unix(100, 0)
	limiter := controllers.NewSpaceRateLimiter(2, time.Minute, func() time.Time { return now })
	a, b := uuid.New(), uuid.New()
	if !limiter.Allow(a) || !limiter.Allow(a) || limiter.Allow(a) {
		t.Fatal("actor should be limited after two actions")
	}
	if !limiter.Allow(b) {
		t.Fatal("rate limit should be isolated per actor")
	}
	now = now.Add(time.Minute)
	if !limiter.Allow(a) {
		t.Fatal("rate limit should refill after its window")
	}
}
