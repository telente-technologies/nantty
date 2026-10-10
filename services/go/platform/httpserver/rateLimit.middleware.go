package httpserver

import (
	"net/http"
	"sync"
	"time"
)

type tokenBucket struct {
	tokens     float64
	lastRefill time.Time
}

type rateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*tokenBucket
	rate    float64
	burst   float64
}

func newRateLimiter(rate, burst int) *rateLimiter {
	return &rateLimiter{
		buckets: make(map[string]*tokenBucket),
		rate:    float64(rate),
		burst:   float64(burst),
	}
}

func (limiter *rateLimiter) allow(key string) bool {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	now := time.Now()
	bucket, exists := limiter.buckets[key]
	if !exists {
		bucket = &tokenBucket{tokens: limiter.burst, lastRefill: now}
		limiter.buckets[key] = bucket
	}

	elapsed := now.Sub(bucket.lastRefill).Seconds()
	bucket.lastRefill = now
	bucket.tokens += elapsed * limiter.rate
	if bucket.tokens > limiter.burst {
		bucket.tokens = limiter.burst
	}

	if bucket.tokens >= 1.0 {
		bucket.tokens--
		return true
	}
	return false
}

func (limiter *rateLimiter) cleanup() {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	cutoff := time.Now().Add(-5 * time.Second)
	for key, bucket := range limiter.buckets {
		if bucket.lastRefill.Before(cutoff) {
			delete(limiter.buckets, key)
		}
	}
}

var (
	globalRateLimiter = newRateLimiter(100, 200)
	authRateLimiter   = newRateLimiter(10, 20)
	staffRateLimiter  = newRateLimiter(30, 60)
	cleanupStopChan   = make(chan struct{})
)

func init() {
	cleanupTicker := time.NewTicker(30 * time.Second)
	go func() {
		for {
			select {
			case <-cleanupTicker.C:
				globalRateLimiter.cleanup()
				authRateLimiter.cleanup()
				staffRateLimiter.cleanup()
			case <-cleanupStopChan:
				cleanupTicker.Stop()
				return
			}
		}
	}()
}

func StopRateLimiters() {
	select {
	case <-cleanupStopChan:
	default:
		close(cleanupStopChan)
	}
}

func RateLimitEveryRequest(isProduction bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			clientKey := ClientIP(request)
			if clientKey == "" {
				clientKey = request.RemoteAddr
			}
			if !globalRateLimiter.allow(clientKey) {
				writer.Header().Set("Retry-After", "60")
				WriteJsonResponse(writer, http.StatusTooManyRequests, NewApiError(http.StatusTooManyRequests, "RATE_LIMITED", "Too many requests. Please try again later."))
				return
			}
			next.ServeHTTP(writer, request)
		})
	}
}

func RateLimitAuthEndpoints() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			clientKey := ClientIP(request)
			if clientKey == "" {
				clientKey = request.RemoteAddr
			}
			if !authRateLimiter.allow(clientKey) {
				writer.Header().Set("Retry-After", "60")
				WriteJsonResponse(writer, http.StatusTooManyRequests, NewApiError(http.StatusTooManyRequests, "RATE_LIMITED", "Too many authentication attempts. Please try again later."))
				return
			}
			next.ServeHTTP(writer, request)
		})
	}
}

func RateLimitStaffEndpoints() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			clientKey := ClientIP(request)
			if clientKey == "" {
				clientKey = request.RemoteAddr
			}
			if !staffRateLimiter.allow(clientKey) {
				writer.Header().Set("Retry-After", "60")
				WriteJsonResponse(writer, http.StatusTooManyRequests, NewApiError(http.StatusTooManyRequests, "RATE_LIMITED", "Too many requests. Please try again later."))
				return
			}
			next.ServeHTTP(writer, request)
		})
	}
}
