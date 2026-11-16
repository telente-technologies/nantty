package controllers

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

type SpaceRateLimiter struct {
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

func NewSpaceRateLimiter(limit int, window time.Duration, now func() time.Time) *SpaceRateLimiter {
	if now == nil {
		now = time.Now
	}
	return &SpaceRateLimiter{buckets: make(map[uuid.UUID]spaceRateBucket), limit: limit, window: window, now: now}
}

func (limiter *SpaceRateLimiter) Allow(userID uuid.UUID) bool {
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

var spacesMutationLimiter = NewSpaceRateLimiter(12, time.Minute, nil)
