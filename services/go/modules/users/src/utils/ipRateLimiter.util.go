package utils

import (
	"sync"
	"time"
)

type IpRateLimiter struct {
	mutex       sync.Mutex
	buckets     map[string]*tokenBucket
	perMinute   int
	now         func() time.Time
	lastSweepAt time.Time
}

type tokenBucket struct {
	tokens   float64
	refilled time.Time
}

func NewIpRateLimiter(perMinute int, now func() time.Time) *IpRateLimiter {
	return &IpRateLimiter{buckets: map[string]*tokenBucket{}, perMinute: perMinute, now: now}
}

func (limiter *IpRateLimiter) Allow(key string) bool {
	limiter.mutex.Lock()
	defer limiter.mutex.Unlock()
	current := limiter.now()
	limiter.sweepIdleBucketsLocked(current)
	bucket, found := limiter.buckets[key]
	if !found {
		bucket = &tokenBucket{tokens: float64(limiter.perMinute), refilled: current}
		limiter.buckets[key] = bucket
	}
	elapsed := current.Sub(bucket.refilled).Minutes()
	bucket.tokens = min(float64(limiter.perMinute), bucket.tokens+elapsed*float64(limiter.perMinute))
	bucket.refilled = current
	if bucket.tokens < 1 {
		return false
	}
	bucket.tokens--
	return true
}

func (limiter *IpRateLimiter) sweepIdleBucketsLocked(current time.Time) {
	if current.Sub(limiter.lastSweepAt) < 5*time.Minute {
		return
	}
	limiter.lastSweepAt = current
	for key, bucket := range limiter.buckets {
		if current.Sub(bucket.refilled) > 10*time.Minute {
			delete(limiter.buckets, key)
		}
	}
}
