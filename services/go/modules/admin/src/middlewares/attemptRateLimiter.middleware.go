package middlewares

import (
	"sync"
	"time"
)

type bucket struct {
	tokens     float64
	lastRefill time.Time
}

type AttemptRateLimiter struct {
	mutex           sync.Mutex
	buckets         map[string]*bucket
	capacity        float64
	refillPerSecond float64
	now             func() time.Time
}

func NewAttemptRateLimiter(capacity int, refillEvery time.Duration, now func() time.Time) *AttemptRateLimiter {
	return &AttemptRateLimiter{buckets: map[string]*bucket{}, capacity: float64(capacity), refillPerSecond: 1 / refillEvery.Seconds(), now: now}
}

func (limiter *AttemptRateLimiter) Allow(key string) bool {
	limiter.mutex.Lock()
	defer limiter.mutex.Unlock()
	moment := limiter.now()
	if len(limiter.buckets) > 10_000 {
		limiter.discardFullBucketsLocked(moment)
	}
	current, found := limiter.buckets[key]
	if !found {
		current = &bucket{tokens: limiter.capacity, lastRefill: moment}
		limiter.buckets[key] = current
	}
	current.tokens = min(limiter.capacity, current.tokens+moment.Sub(current.lastRefill).Seconds()*limiter.refillPerSecond)
	current.lastRefill = moment
	if current.tokens < 1 {
		return false
	}
	current.tokens--
	return true
}

func (limiter *AttemptRateLimiter) discardFullBucketsLocked(moment time.Time) {
	for key, current := range limiter.buckets {
		if current.tokens+moment.Sub(current.lastRefill).Seconds()*limiter.refillPerSecond >= limiter.capacity {
			delete(limiter.buckets, key)
		}
	}
}
