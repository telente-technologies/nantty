package controllers

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

type spaceRateLimiter struct {
	mu      sync.Mutex
	buckets map[uuid.UUID]spaceRateBucket
	limit   int
	window  time.Duration
	now     func() time.Time
}

type spaceRateBucket struct {
	started time.Time
	count   int
}

func newSpaceRateLimiter(limit int, window time.Duration) *spaceRateLimiter {
	return &spaceRateLimiter{buckets: make(map[uuid.UUID]spaceRateBucket), limit: limit, window: window, now: time.Now}
}

func (limiter *spaceRateLimiter) allow(userID uuid.UUID) bool {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	now := limiter.now()
	bucket := limiter.buckets[userID]
	if bucket.started.IsZero() || now.Sub(bucket.started) >= limiter.window {
		bucket = spaceRateBucket{started: now}
	}
	if bucket.count >= limiter.limit {
		limiter.buckets[userID] = bucket
		return false
	}
	bucket.count++
	limiter.buckets[userID] = bucket
	return true
}

var spacesMutationLimiter = newSpaceRateLimiter(12, time.Minute)
